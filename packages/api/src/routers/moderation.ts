import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, count, asc } from "drizzle-orm";

import { protectedProcedure, router } from "../index";
import { db } from "@sip-and-speak/db";
import { userFlag } from "@sip-and-speak/db/schema/sip-and-speak";
import { user } from "@sip-and-speak/db/schema/auth";
import {
  checkSelfFlag,
  checkDuplicateOpenFlag,
  FLAG_VALIDATION_MESSAGES,
  buildStudentFlaggedEvent,
  buildFlagQueueEntry,
} from "./moderation-utils";
import { persistFlag } from "./moderation-persist";
import { domainEvents } from "../domain-events";

export const flagReasonSchema = z.enum([
  "OFFENSIVE_LANGUAGE",
  "HARASSMENT",
  "SPAM",
  "INAPPROPRIATE_BEHAVIOR",
  "OTHER",
]);

export type FlagReason = z.infer<typeof flagReasonSchema>;

export const flagReasonLabels: Record<FlagReason, string> = {
  OFFENSIVE_LANGUAGE: "Offensive language",
  HARASSMENT: "Harassment",
  SPAM: "Spam",
  INAPPROPRIATE_BEHAVIOR: "Inappropriate behaviour",
  OTHER: "Other",
};

export const moderationRouter = router({
  /**
   * #78 — List all open flags sorted oldest-first for the Moderator queue.
   * Any authenticated user can call this query; Moderator RBAC is deferred
   * until a role field is added to the user schema. (TODO: tighten once role exists)
   */
  listOpenFlags: protectedProcedure.query(async () => {
    const rows = await db
      .select({
        id: userFlag.id,
        targetId: userFlag.targetId,
        targetName: user.name,
        reason: userFlag.reason,
        createdAt: userFlag.createdAt,
      })
      .from(userFlag)
      .leftJoin(user, eq(userFlag.targetId, user.id))
      .where(eq(userFlag.status, "open"))
      .orderBy(asc(userFlag.createdAt));

    return rows.map(buildFlagQueueEntry);
  }),

  /**
   * #65/#67 — Flag submission with validation.
   * Persistence (#72) is implemented in a subsequent task.
   */
  flagStudent: protectedProcedure
    .input(
      z.object({
        targetId: z.string(),
        reason: flagReasonSchema,
        detail: z.string().max(450).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const reporterId = ctx.session.user.id;

      // #67 — Self-flag check
      const selfCheck = checkSelfFlag(reporterId, input.targetId);
      if (!selfCheck.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: FLAG_VALIDATION_MESSAGES[selfCheck.error],
        });
      }

      // #67 — Duplicate open flag check
      const rows = await db
        .select({ count: count() })
        .from(userFlag)
        .where(
          and(
            eq(userFlag.reporterId, reporterId),
            eq(userFlag.targetId, input.targetId),
            eq(userFlag.status, "open"),
          ),
        );

      const openCount = rows[0]?.count ?? 0;
      const dupCheck = checkDuplicateOpenFlag(Number(openCount));
      if (!dupCheck.valid) {
        throw new TRPCError({
          code: "CONFLICT",
          message: FLAG_VALIDATION_MESSAGES[dupCheck.error],
        });
      }

      // #72 — Persist the flag and emit domain event
      const flag = await persistFlag({
        reporterId,
        targetId: input.targetId,
        reason: input.reason,
        detail: input.detail,
      });

      domainEvents.emit(
        "StudentFlagged",
        buildStudentFlaggedEvent(flag.id, { reporterId, targetId: input.targetId, reason: input.reason }, flag.createdAt),
      );

      return { ok: true as const };
    }),
});
