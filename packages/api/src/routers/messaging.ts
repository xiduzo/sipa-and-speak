import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";

import { protectedProcedure, router } from "../index";
import { domainEvents } from "../domain-events";
import { db } from "@sip-and-speak/db";
import { meetup, messagingOptIn, conversation } from "@sip-and-speak/db/schema/sip-and-speak";
import { hasAlreadyResponded, getPartnerId, shouldSendNudge, bothAccepted, isDeclineOutcome, validateMessageContent, checkConversationAccess } from "./messaging-utils";
import { persistMessage } from "./messaging-persist";

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

      if (hasAlreadyResponded(existingResponse)) {
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

      const partnerId = getPartnerId(existing.proposerId, existing.receiverId, studentId);

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

        if (shouldSendNudge("accept", partnerResponse)) {
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
            domainEvents.emit("MessagingNudgeNeeded", {
              meetupId: input.meetupId,
              acceptingStudentId: studentId,
              pendingStudentId: partnerId,
            });
          }
        }

        // #141 — Check if both Students have now accepted; if so, open the conversation
        const allResponses = await db
          .select({ response: messagingOptIn.response })
          .from(messagingOptIn)
          .where(eq(messagingOptIn.meetupId, input.meetupId));

        if (bothAccepted(allResponses)) {
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
            console.log(
              `[messaging] conversation opened conversationId=${newConversation.id} meetupId=${input.meetupId}`,
            );
            domainEvents.emit("ConversationOpened", {
              conversationId: newConversation.id,
              meetupId: input.meetupId,
              studentAId: studentId,
              studentBId: partnerId,
              openedAt: newConversation.createdAt,
            });
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

        if (isDeclineOutcome(declineResponses)) {
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

      return { recorded: true as const };
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
      const created = await persistMessage({
        conversationId: input.conversationId,
        senderId,
        content: validation.trimmed,
      });

      console.log(
        `[messaging] message sent conversationId=${input.conversationId} senderId=${senderId}`,
      );

      return created;
    }),
});
