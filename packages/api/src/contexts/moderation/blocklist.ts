/**
 * #109 — Email blocklist functions for the moderation public surface.
 *
 * These are exported from the moderation context (via index.ts) because
 * other contexts/apps consume them — `addEmailToBlocklist` from the
 * cascade handler on StudentRemoved, and `isEmailBlocklisted` from
 * registration-time gating in apps/server.
 */
import { eq } from "drizzle-orm";
import { db } from "@sip-and-speak/db";
import { blockedEmail } from "@sip-and-speak/db/schema/sip-and-speak";
import { normalizeEmail } from "./moderation-utils";

/**
 * Adds an email to the blocked list (idempotent via onConflictDoNothing).
 */
export async function addEmailToBlocklist(email: string): Promise<void> {
  await db
    .insert(blockedEmail)
    .values({ email: normalizeEmail(email) })
    .onConflictDoNothing();
}

/**
 * Returns true if the email is on the blocklist.
 */
export async function isEmailBlocklisted(email: string): Promise<boolean> {
  const rows = await db
    .select({ id: blockedEmail.id })
    .from(blockedEmail)
    .where(eq(blockedEmail.email, normalizeEmail(email)))
    .limit(1);
  return rows.length > 0;
}
