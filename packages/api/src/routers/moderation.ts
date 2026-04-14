import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, count } from "drizzle-orm";

import { protectedProcedure, router } from "../index";
import { db } from "@sip-and-speak/db";
import { userFlag } from "@sip-and-speak/db/schema/sip-and-speak";
import {
  checkSelfFlag,
  checkDuplicateOpenFlag,
  FLAG_VALIDATION_MESSAGES,
} from "./moderation-utils";

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

      // Stub — persistence implemented in task #72
      return { ok: true as const };
    }),
});
