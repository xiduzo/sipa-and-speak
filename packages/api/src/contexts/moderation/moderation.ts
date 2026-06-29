import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, count, asc, desc, ne, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  isModeratorEmail,
  moderatorProcedure,
  protectedProcedure,
  router,
} from "../../index";
import { db } from "@sip-and-speak/db";
import { userFlag } from "@sip-and-speak/db/schema/moderation";
import { user } from "@sip-and-speak/db/schema/auth";
import {
  FLAG_VALIDATION_MESSAGES,
  buildFlagQueueEntry,
  buildFlagDetail,
  STUDENT_INACTIVE_MESSAGE,
} from "./moderation-utils";
import { domainEvents } from "../../domain-events";

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
   * Whether the current session belongs to a moderator (email is in the
   * MODERATOR_EMAILS allowlist). Unlike the moderator-only procedures this is a
   * plain protected query — it returns false rather than throwing — so the
   * signed-in shell can decide whether to show back-of-house navigation and the
   * post-sign-in redirect can route admins to /admin.
   */
  amIModerator: protectedProcedure.query(({ ctx }) =>
    isModeratorEmail(ctx.session.user.email),
  ),

  /**
   * #78 — List all open flags sorted oldest-first for the Moderator queue.
   * Any authenticated user can call this query; Moderator RBAC is deferred
   * until a role field is added to the user schema. (TODO: tighten once role exists)
   */
  listOpenFlags: moderatorProcedure.query(async () => {
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
   * #80 — Get full flag detail for Moderator review.
   * Returns flag info, flagged Student identity, and prior resolved flag history.
   */
  getFlagDetail: moderatorProcedure
    .input(z.object({ flagId: z.string() }))
    .query(async ({ input }) => {
      const flagRows = await db
        .select({
          id: userFlag.id,
          targetId: userFlag.targetId,
          targetName: user.name,
          targetStatus: user.studentStatus,
          reason: userFlag.reason,
          detail: userFlag.detail,
          createdAt: userFlag.createdAt,
        })
        .from(userFlag)
        .leftJoin(user, eq(userFlag.targetId, user.id))
        .where(eq(userFlag.id, input.flagId))
        .limit(1);

      const flag = flagRows[0];
      if (!flag) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Flag not found." });
      }

      // Prior resolved flags for the same Student (excluding the current flag)
      const priorRows = await db
        .select({
          reason: userFlag.reason,
          outcome: userFlag.outcome,
          createdAt: userFlag.createdAt,
          resolvedAt: userFlag.resolvedAt,
        })
        .from(userFlag)
        .where(
          and(
            eq(userFlag.targetId, flag.targetId),
            eq(userFlag.status, "resolved"),
            ne(userFlag.id, input.flagId),
          ),
        )
        .orderBy(asc(userFlag.createdAt));

      return buildFlagDetail(flag, priorRows);
    }),

  /**
   * #88/#90 — Warn a flagged Student.
   * Resolves the flag with outcome 'warned', records moderator identity + timestamp,
   * and emits the StudentWarned domain event.
   */
  warnStudent: moderatorProcedure
    .input(z.object({ flagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const moderatorId = ctx.session.user.id;

      // Two-step guard: distinguish "not found" from "already resolved"
      const flagRows = await db
        .select({ id: userFlag.id, status: userFlag.status, targetId: userFlag.targetId })
        .from(userFlag)
        .where(eq(userFlag.id, input.flagId))
        .limit(1);

      if (!flagRows[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Flag not found." });
      }
      if (flagRows[0].status !== "open") {
        throw new TRPCError({ code: "CONFLICT", message: "Flag already resolved." });
      }

      // #92 — Guard: reject if Student is removed or suspended
      const studentRows = await db
        .select({ id: user.id, studentStatus: user.studentStatus })
        .from(user)
        .where(eq(user.id, flagRows[0].targetId))
        .limit(1);

      const studentExists = !!studentRows[0];
      const studentSuspended = studentRows[0]?.studentStatus === "suspended";
      if (!studentExists || studentSuspended) {
        throw new TRPCError({ code: "BAD_REQUEST", message: STUDENT_INACTIVE_MESSAGE });
      }

      const warnedAt = new Date();
      const [warnUpdated] = await db
        .update(userFlag)
        .set({ status: "resolved", outcome: "warned", moderatorId, resolvedAt: warnedAt })
        .where(eq(userFlag.id, input.flagId))
        .returning({ targetId: userFlag.targetId });

      domainEvents.emit("StudentWarned", {
        flagId: input.flagId,
        targetId: warnUpdated!.targetId,
        moderatorId,
        warnedAt,
      });

      return { success: true as const };
    }),

  /**
   * #100/#103 — Suspend a flagged Student.
   * Sets studentStatus to 'suspended', resolves flag with outcome 'suspended',
   * and emits the StudentSuspended domain event.
   *
   * TODO: integration test should verify the db.transaction() atomicity —
   * partial failure between the user.studentStatus write and the userFlag
   * resolution write must roll both back. No integration harness exists yet.
   */
  suspendStudent: moderatorProcedure
    .input(z.object({ flagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const moderatorId = ctx.session.user.id;

      const flagRows = await db
        .select({ id: userFlag.id, status: userFlag.status, targetId: userFlag.targetId })
        .from(userFlag)
        .where(eq(userFlag.id, input.flagId))
        .limit(1);

      if (!flagRows[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Flag not found." });
      }
      if (flagRows[0].status !== "open") {
        throw new TRPCError({ code: "CONFLICT", message: "Flag already resolved." });
      }

      const studentRows = await db
        .select({ id: user.id, studentStatus: user.studentStatus })
        .from(user)
        .where(eq(user.id, flagRows[0].targetId))
        .limit(1);

      const studentExists = !!studentRows[0];
      const studentSuspended = studentRows[0]?.studentStatus === "suspended";
      if (!studentExists || studentSuspended) {
        throw new TRPCError({ code: "BAD_REQUEST", message: STUDENT_INACTIVE_MESSAGE });
      }

      const targetId = flagRows[0].targetId;
      const suspendedAt = new Date();

      const { resolvedTargetId } = await db.transaction(async (tx) => {
        await tx
          .update(user)
          .set({ studentStatus: "suspended" })
          .where(eq(user.id, targetId));

        const [updated] = await tx
          .update(userFlag)
          .set({ status: "resolved", outcome: "suspended", moderatorId, resolvedAt: suspendedAt })
          .where(eq(userFlag.id, input.flagId))
          .returning({ targetId: userFlag.targetId });

        return { resolvedTargetId: updated!.targetId };
      });

      domainEvents.emit("StudentSuspended", {
        flagId: input.flagId,
        targetId: resolvedTargetId,
        moderatorId,
        suspendedAt,
      });

      return { success: true as const };
    }),

  /**
   * #105 — Lift a Student's suspension.
   * Resets studentStatus to 'active' and emits SuspensionLifted event.
   */
  liftSuspension: moderatorProcedure
    .input(z.object({ targetId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const moderatorId = ctx.session.user.id;

      const studentRows = await db
        .select({ id: user.id, studentStatus: user.studentStatus })
        .from(user)
        .where(eq(user.id, input.targetId))
        .limit(1);

      if (!studentRows[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Student not found." });
      }
      if (studentRows[0].studentStatus !== "suspended") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Student is not suspended." });
      }

      const liftedAt = new Date();
      await db
        .update(user)
        .set({ studentStatus: "active" })
        .where(eq(user.id, input.targetId));

      domainEvents.emit("SuspensionLifted", {
        targetId: input.targetId,
        moderatorId,
        liftedAt,
      });

      return { success: true as const };
    }),

  /**
   * #107/#108 — Permanently remove a flagged Student.
   * Sets studentStatus to 'removed', resolves flag with outcome 'removed',
   * and emits the StudentRemoved domain event.
   *
   * TODO: integration test should verify the db.transaction() atomicity —
   * partial failure between the user.studentStatus write and the userFlag
   * resolution write must roll both back. No integration harness exists yet.
   */
  removeStudent: moderatorProcedure
    .input(z.object({ flagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const moderatorId = ctx.session.user.id;

      const flagRows = await db
        .select({ id: userFlag.id, status: userFlag.status, targetId: userFlag.targetId })
        .from(userFlag)
        .where(eq(userFlag.id, input.flagId))
        .limit(1);

      if (!flagRows[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Flag not found." });
      }
      if (flagRows[0].status !== "open") {
        throw new TRPCError({ code: "CONFLICT", message: "Flag already resolved." });
      }

      const studentRows = await db
        .select({ id: user.id, studentStatus: user.studentStatus })
        .from(user)
        .where(eq(user.id, flagRows[0].targetId))
        .limit(1);

      if (studentRows[0]?.studentStatus === "removed") {
        // Idempotent — already removed, return success without side effects
        return { success: true as const };
      }

      const targetId = flagRows[0].targetId;
      const removedAt = new Date();

      const { resolvedTargetId } = await db.transaction(async (tx) => {
        await tx
          .update(user)
          .set({ studentStatus: "removed" })
          .where(eq(user.id, targetId));

        const [updated] = await tx
          .update(userFlag)
          .set({ status: "resolved", outcome: "removed", moderatorId, resolvedAt: removedAt })
          .where(eq(userFlag.id, input.flagId))
          .returning({ targetId: userFlag.targetId });

        return { resolvedTargetId: updated!.targetId };
      });

      domainEvents.emit("StudentRemoved", {
        flagId: input.flagId,
        targetId: resolvedTargetId,
        moderatorId,
        removedAt,
      });

      return { success: true as const };
    }),

  /**
   * #65/#67 — Flag submission with validation.
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
      if (reporterId === input.targetId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: FLAG_VALIDATION_MESSAGES.SELF_FLAG,
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

      const openCount = Number(rows[0]?.count ?? 0);
      if (openCount > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: FLAG_VALIDATION_MESSAGES.DUPLICATE_OPEN_FLAG,
        });
      }

      // #72 — Persist the flag and emit domain event
      const [flag] = await db
        .insert(userFlag)
        .values({
          reporterId,
          targetId: input.targetId,
          reason: input.reason,
          detail: input.detail,
          status: "open",
        })
        .returning();

      domainEvents.emit("StudentFlagged", {
        flagId: flag!.id,
        reporterId,
        targetId: input.targetId,
        reason: input.reason,
        flaggedAt: flag!.createdAt,
      });

      return { ok: true as const };
    }),

  /**
   * Admin — list every report ever filed (open and resolved), newest first.
   * Joins both the reporter and the target so the admin Reports view can show
   * "who reported whom". Unlike `listOpenFlags`, this is not limited to open.
   */
  listAllFlags: moderatorProcedure.query(async () => {
    const reporter = alias(user, "reporter");
    const target = alias(user, "target");

    const rows = await db
      .select({
        id: userFlag.id,
        reporterId: userFlag.reporterId,
        reporterName: reporter.name,
        targetId: userFlag.targetId,
        targetName: target.name,
        targetStatus: target.studentStatus,
        reason: userFlag.reason,
        detail: userFlag.detail,
        status: userFlag.status,
        outcome: userFlag.outcome,
        createdAt: userFlag.createdAt,
        resolvedAt: userFlag.resolvedAt,
      })
      .from(userFlag)
      .leftJoin(reporter, eq(userFlag.reporterId, reporter.id))
      .leftJoin(target, eq(userFlag.targetId, target.id))
      .orderBy(desc(userFlag.createdAt));

    return rows;
  }),

  /**
   * Admin — list all active (non-deleted) Students with their moderation
   * status and a count of open reports filed against each, newest first.
   */
  listUsers: moderatorProcedure.query(async () => {
    const users = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        studentStatus: user.studentStatus,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(isNull(user.deletedAt))
      .orderBy(desc(user.createdAt));

    const flagCounts = await db
      .select({ targetId: userFlag.targetId, openCount: count() })
      .from(userFlag)
      .where(eq(userFlag.status, "open"))
      .groupBy(userFlag.targetId);

    const openByTarget = new Map(
      flagCounts.map((row) => [row.targetId, Number(row.openCount)]),
    );

    return users.map((u) => ({
      ...u,
      openFlagCount: openByTarget.get(u.id) ?? 0,
    }));
  }),

  /**
   * Admin — suspend a Student directly from the Users list (no report needed).
   * Mirrors `suspendStudent` minus the flag resolution: sets studentStatus to
   * 'suspended' and emits StudentSuspended (flagId null) so the same cascade
   * handlers cancel proposals and suspend conversations.
   */
  suspendUser: moderatorProcedure
    .input(z.object({ targetId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const moderatorId = ctx.session.user.id;

      const rows = await db
        .select({ id: user.id, studentStatus: user.studentStatus })
        .from(user)
        .where(eq(user.id, input.targetId))
        .limit(1);

      const target = rows[0];
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Student not found." });
      }
      if (target.studentStatus === "removed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Student has been removed." });
      }
      if (target.studentStatus === "suspended") {
        throw new TRPCError({ code: "CONFLICT", message: "Student is already suspended." });
      }

      const suspendedAt = new Date();
      await db
        .update(user)
        .set({ studentStatus: "suspended" })
        .where(eq(user.id, input.targetId));

      domainEvents.emit("StudentSuspended", {
        flagId: null,
        targetId: input.targetId,
        moderatorId,
        suspendedAt,
      });

      return { success: true as const };
    }),

  /**
   * Admin — permanently remove a Student directly from the Users list.
   * Mirrors `removeStudent` minus the flag resolution. Idempotent. Emits
   * StudentRemoved (flagId null); the cascade blocklists the email and closes
   * conversations.
   */
  removeUser: moderatorProcedure
    .input(z.object({ targetId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const moderatorId = ctx.session.user.id;

      const rows = await db
        .select({ id: user.id, studentStatus: user.studentStatus })
        .from(user)
        .where(eq(user.id, input.targetId))
        .limit(1);

      const target = rows[0];
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Student not found." });
      }
      if (target.studentStatus === "removed") {
        // Idempotent — already removed, no side effects
        return { success: true as const };
      }

      const removedAt = new Date();
      await db
        .update(user)
        .set({ studentStatus: "removed" })
        .where(eq(user.id, input.targetId));

      domainEvents.emit("StudentRemoved", {
        flagId: null,
        targetId: input.targetId,
        moderatorId,
        removedAt,
      });

      return { success: true as const };
    }),
});
