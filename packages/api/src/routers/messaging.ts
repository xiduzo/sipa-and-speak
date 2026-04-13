import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";

import { protectedProcedure, router } from "../index";
import { domainEvents } from "../domain-events";
import { db } from "@sip-and-speak/db";
import { meetup, messagingOptIn } from "@sip-and-speak/db/schema/sip-and-speak";
import { hasAlreadyResponded, getPartnerId, shouldSendNudge } from "./messaging-utils";

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
      } else {
        domainEvents.emit("MessagingDeclined", {
          meetupId: input.meetupId,
          studentId,
          partnerId,
          respondedAt: created!.respondedAt,
        });
      }

      console.log(
        `[messaging] opt-in response recorded meetupId=${input.meetupId} studentId=${studentId} response=${input.response}`,
      );

      return { recorded: true as const };
    }),
});
