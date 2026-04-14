/**
 * #72 — Persistence helpers for the flag submission flow.
 * Extracted for unit testing without requiring a live tRPC context.
 */
import { eq } from "drizzle-orm";

import { db } from "@sip-and-speak/db";
import { userFlag, blockedEmail } from "@sip-and-speak/db/schema/sip-and-speak";
import { buildFlagValues, buildWarnFlagValues, buildSuspendFlagValues, buildRemoveFlagValues, normalizeEmail } from "./moderation-utils";
import { user } from "@sip-and-speak/db/schema/auth";

export interface PersistFlagInput {
  reporterId: string;
  targetId: string;
  reason: string;
  detail?: string;
}

/**
 * Inserts a flag row with status 'open' and returns the created record.
 * Throws on DB failure — no partial record is created.
 */
export async function persistFlag(input: PersistFlagInput) {
  const [created] = await db
    .insert(userFlag)
    .values(buildFlagValues(input))
    .returning();

  return created!;
}

/**
 * #90 — Resolves a flag with outcome 'warned'.
 * Updates status, outcome, moderatorId, resolvedAt. Returns the resolved flag row.
 */
export async function persistWarnFlag(flagId: string, moderatorId: string) {
  const warnedAt = new Date();
  const [updated] = await db
    .update(userFlag)
    .set(buildWarnFlagValues(moderatorId, warnedAt))
    .where(eq(userFlag.id, flagId))
    .returning({ targetId: userFlag.targetId, warnedAt: userFlag.resolvedAt });

  return { targetId: updated!.targetId, warnedAt };
}

/**
 * #100/#103 — Transitions a Student to suspended state and resolves the flag.
 * Sets user.studentStatus = 'suspended' and resolves the flag with outcome 'suspended'.
 */
export async function persistSuspendStudent(flagId: string, targetId: string, moderatorId: string) {
  const suspendedAt = new Date();
  await db
    .update(user)
    .set({ studentStatus: "suspended" })
    .where(eq(user.id, targetId));

  const [updated] = await db
    .update(userFlag)
    .set(buildSuspendFlagValues(moderatorId, suspendedAt))
    .where(eq(userFlag.id, flagId))
    .returning({ targetId: userFlag.targetId, suspendedAt: userFlag.resolvedAt });

  return { targetId: updated!.targetId, suspendedAt };
}

/**
 * #108 — Permanently removes a Student.
 * Sets user.studentStatus = 'removed' and resolves the flag with outcome 'removed'.
 */
export async function persistRemoveStudent(flagId: string, targetId: string, moderatorId: string) {
  const removedAt = new Date();
  await db
    .update(user)
    .set({ studentStatus: "removed" })
    .where(eq(user.id, targetId));

  const [updated] = await db
    .update(userFlag)
    .set(buildRemoveFlagValues(moderatorId, removedAt))
    .where(eq(userFlag.id, flagId))
    .returning({ targetId: userFlag.targetId });

  return { targetId: updated!.targetId, removedAt };
}

/**
 * #109 — Adds an email to the blocked list (idempotent via onConflictDoNothing).
 */
export async function addEmailToBlocklist(email: string) {
  await db
    .insert(blockedEmail)
    .values({ email: normalizeEmail(email) })
    .onConflictDoNothing();
}

/**
 * #109 — Returns true if the email is on the blocklist.
 */
export async function isEmailBlocklisted(email: string): Promise<boolean> {
  const rows = await db
    .select({ id: blockedEmail.id })
    .from(blockedEmail)
    .where(eq(blockedEmail.email, normalizeEmail(email)))
    .limit(1);
  return rows.length > 0;
}

/**
 * #105 — Lifts a Student's suspension.
 * Sets user.studentStatus back to 'active'.
 */
export async function persistLiftSuspension(targetId: string) {
  const liftedAt = new Date();
  await db
    .update(user)
    .set({ studentStatus: "active" })
    .where(eq(user.id, targetId));

  return { liftedAt };
}
