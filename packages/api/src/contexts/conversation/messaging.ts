import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";

import { protectedProcedure, router } from "../../index";
import { domainEvents } from "../../domain-events";
import { db } from "@sip-and-speak/db";
import { messagingOptIn, conversation, conversationPresence, message } from "@sip-and-speak/db/schema/conversation";
import { meetup } from "@sip-and-speak/db/schema/scheduling";
import { user } from "@sip-and-speak/db/schema/auth";
import {
  validateMessageContent,
  checkConversationAccess,
  isMutuallyOptedIn,
  isOptInDeclineOutcome,
} from "./messaging-utils";

export const messagingRouter = router({
  /**
   * #139 — Record a Student's accept/decline response to the messaging opt-in prompt.
   * Each (meetupId, studentId) pair can only respond once.
   */
  respondToOptIn: protectedProcedure
    .input(
      z.object({
        meetupId: z.string(),
        response: z.enum(["accept", "decline"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const studentId = ctx.session.user.id;

      // Verify meetup exists and student is a participant
      const [existing] = await db
        .select({
          id: meetup.id,
          status: meetup.status,
          proposerId: meetup.proposerId,
          receiverId: meetup.receiverId,
        })
        .from(meetup)
        .where(eq(meetup.id, input.meetupId))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meetup not found" });
      }

      const isParticipant =
        existing.proposerId === studentId || existing.receiverId === studentId;

      if (!isParticipant) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a participant in this meetup",
        });
      }

      if (existing.status !== "completed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Messaging opt-in is only available for completed meetups",
        });
      }

      // Enforce one response per (meetupId, studentId)
      const [existingResponse] = await db
        .select({ response: messagingOptIn.response })
        .from(messagingOptIn)
        .where(
          and(
            eq(messagingOptIn.meetupId, input.meetupId),
            eq(messagingOptIn.studentId, studentId),
          ),
        )
        .limit(1);

      if (existingResponse !== undefined) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You have already responded to the messaging opt-in for this meetup",
        });
      }

      const [created] = await db
        .insert(messagingOptIn)
        .values({
          meetupId: input.meetupId,
          studentId,
          response: input.response,
        })
        .returning();

      const partnerId = existing.proposerId === studentId ? existing.receiverId : existing.proposerId;

      // When this response opens the conversation (both accepted) we hand the
      // new conversation id back so the client can route straight into the open
      // chat instead of being stranded on the now-stale locked screen (bug A1).
      let openedConversationId: string | null = null;

      if (input.response === "accept") {
        domainEvents.emit("MessagingAccepted", {
          meetupId: input.meetupId,
          studentId,
          partnerId,
          respondedAt: created!.respondedAt,
        });

        // #140 — Check if partner has responded; if not, nudge them
        const [partnerResponse] = await db
          .select({ response: messagingOptIn.response })
          .from(messagingOptIn)
          .where(
            and(
              eq(messagingOptIn.meetupId, input.meetupId),
              eq(messagingOptIn.studentId, partnerId),
            ),
          )
          .limit(1);

        if (partnerResponse === undefined) {
          // Atomically mark nudge as sent to prevent duplicates on concurrent accepts
          const updated = await db
            .update(messagingOptIn)
            .set({ nudgeSentAt: new Date() })
            .where(
              and(
                eq(messagingOptIn.meetupId, input.meetupId),
                eq(messagingOptIn.studentId, studentId),
                isNull(messagingOptIn.nudgeSentAt),
              ),
            )
            .returning({ id: messagingOptIn.id });

          if (updated.length > 0) {
            const [acceptingRow] = await db.select({ name: user.name }).from(user).where(eq(user.id, studentId)).limit(1);
            domainEvents.emit("MessagingNudgeNeeded", {
              meetupId: input.meetupId,
              acceptingStudentId: studentId,
              acceptingStudentName: acceptingRow?.name ?? "Your match",
              pendingStudentId: partnerId,
            });
          }
        }

        // #141 — Check if both Students have now accepted; if so, open the conversation
        const allResponses = await db
          .select({ response: messagingOptIn.response })
          .from(messagingOptIn)
          .where(eq(messagingOptIn.meetupId, input.meetupId));

        if (isMutuallyOptedIn(allResponses.map((r) => r.response))) {
          // Use INSERT ... ON CONFLICT DO NOTHING to guard against race conditions
          const [newConversation] = await db
            .insert(conversation)
            .values({
              user1Id: studentId,
              user2Id: partnerId,
              meetupId: input.meetupId,
            })
            .onConflictDoNothing({ target: conversation.meetupId })
            .returning();

          if (newConversation) {
            openedConversationId = newConversation.id;
            console.log(
              `[messaging] conversation opened conversationId=${newConversation.id} meetupId=${input.meetupId}`,
            );
            const [studentARow, studentBRow] = await Promise.all([
              db.select({ name: user.name }).from(user).where(eq(user.id, studentId)).limit(1),
              db.select({ name: user.name }).from(user).where(eq(user.id, partnerId)).limit(1),
            ]);
            domainEvents.emit("ConversationOpened", {
              conversationId: newConversation.id,
              meetupId: input.meetupId,
              studentAId: studentId,
              studentAName: studentARow[0]?.name ?? "Your match",
              studentBId: partnerId,
              studentBName: studentBRow[0]?.name ?? "Your match",
              openedAt: newConversation.createdAt,
            });
          } else {
            // A concurrent accept already opened (and emitted for) the
            // conversation. Look it up so this caller is still routed in.
            const [existingConv] = await db
              .select({ id: conversation.id })
              .from(conversation)
              .where(eq(conversation.meetupId, input.meetupId))
              .limit(1);
            openedConversationId = existingConv?.id ?? null;
          }
        }
      } else {
        domainEvents.emit("MessagingDeclined", {
          meetupId: input.meetupId,
          studentId,
          partnerId,
          respondedAt: created!.respondedAt,
        });

        // #142 — Check if both have now responded; if any declined, emit outcome
        const declineResponses = await db
          .select({ response: messagingOptIn.response })
          .from(messagingOptIn)
          .where(eq(messagingOptIn.meetupId, input.meetupId));

        if (isOptInDeclineOutcome(declineResponses.map((r) => r.response))) {
          domainEvents.emit("MessagingDeclineOutcome", {
            meetupId: input.meetupId,
            studentAId: studentId,
            studentBId: partnerId,
          });
        }
      }

      console.log(
        `[messaging] opt-in response recorded meetupId=${input.meetupId} studentId=${studentId} response=${input.response}`,
      );

      return { recorded: true as const, conversationId: openedConversationId };
    }),

  /**
   * #143 — Stub: entry point called by the compose UI.
   * Access-gate added in #146, validation in #144, persistence in #145.
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        content: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const senderId = ctx.session.user.id;

      // Suspended/removed Students cannot send. Belt-and-braces with the
      // conversation.status cascade in handleStudentSuspendedSuspendConversations
      // — this guard catches edge cases where conversation status is stale.
      const [sender] = await db
        .select({ studentStatus: user.studentStatus })
        .from(user)
        .where(eq(user.id, senderId))
        .limit(1);
      if (sender?.studentStatus === "suspended" || sender?.studentStatus === "removed") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Suspended or removed Students cannot send messages." });
      }

      // #146 — Access gate: fail fast before any validation or DB write
      const [conv] = await db
        .select({
          id: conversation.id,
          user1Id: conversation.user1Id,
          user2Id: conversation.user2Id,
          status: conversation.status,
        })
        .from(conversation)
        .where(eq(conversation.id, input.conversationId))
        .limit(1);

      const access = checkConversationAccess(conv, senderId);
      if (!access.allowed) {
        const code = access.error === "CONVERSATION_NOT_FOUND" ? "NOT_FOUND" : "FORBIDDEN";
        console.log(
          `[messaging] access denied conversationId=${input.conversationId} senderId=${senderId} reason=${access.error}`,
        );
        throw new TRPCError({ code, message: access.error });
      }

      // #144 — Content validation
      const validation = validateMessageContent(input.content);
      if (!validation.valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: validation.error });
      }

      // #145 — Persist and return the created message
      const [createdRows, senderResult] = await Promise.all([
        db
          .insert(message)
          .values({
            conversationId: input.conversationId,
            senderId,
            content: validation.trimmed,
          })
          .returning(),
        db.select({ name: user.name }).from(user).where(eq(user.id, senderId)).limit(1),
      ]);
      const created = createdRows[0]!;

      // #152 — Notify recipient about new message; suppress if recipient is actively viewing
      const recipientId = conv!.user1Id === senderId ? conv!.user2Id : conv!.user1Id;
      const senderName = senderResult[0]?.name ?? "Your match";
      const [presence] = await db
        .select({ activeUntil: conversationPresence.activeUntil })
        .from(conversationPresence)
        .where(
          and(
            eq(conversationPresence.studentId, recipientId),
            eq(conversationPresence.conversationId, input.conversationId),
          ),
        )
        .limit(1);
      domainEvents.emit("MessageSent", {
        conversationId: input.conversationId,
        senderId,
        recipientId,
        senderName,
        recipientIsPresent: !!presence && presence.activeUntil > new Date(),
      });

      console.log(
        `[messaging] message sent conversationId=${input.conversationId} senderId=${senderId}`,
      );

      return created;
    }),

  /**
   * #153 — Record whether the current Student is actively viewing a conversation.
   * Active: upserts a presence record with a 30-second TTL.
   * Inactive: sets activeUntil to epoch (immediately stale) so push resumes.
   */
  setPresence: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        active: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const studentId = ctx.session.user.id;
      const PRESENCE_TTL_MS = 30_000;

      // Authorization: only a participant may write presence for a conversation.
      const [conv] = await db
        .select({ user1Id: conversation.user1Id, user2Id: conversation.user2Id })
        .from(conversation)
        .where(eq(conversation.id, input.conversationId))
        .limit(1);
      if (!conv || (conv.user1Id !== studentId && conv.user2Id !== studentId)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a participant in this conversation.",
        });
      }

      if (input.active) {
        const activeUntil = new Date(Date.now() + PRESENCE_TTL_MS);
        await db
          .insert(conversationPresence)
          .values({ studentId, conversationId: input.conversationId, activeUntil })
          .onConflictDoUpdate({
            target: [conversationPresence.studentId, conversationPresence.conversationId],
            set: { activeUntil },
          });
        console.log(
          `[messaging] presence set active conversationId=${input.conversationId} studentId=${studentId} until=${activeUntil.toISOString()}`,
        );
      } else {
        await db
          .update(conversationPresence)
          .set({ activeUntil: new Date(0) })
          .where(
            and(
              eq(conversationPresence.studentId, studentId),
              eq(conversationPresence.conversationId, input.conversationId),
            ),
          );
        console.log(
          `[messaging] presence set inactive conversationId=${input.conversationId} studentId=${studentId}`,
        );
      }

      return { ok: true as const };
    }),
});
