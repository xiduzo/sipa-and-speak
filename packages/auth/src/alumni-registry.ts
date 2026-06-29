/**
 * TU/e alumni registry.
 *
 * Backed by the `alumni` database table and managed from the admin interface
 * (replacing the previous hardcoded list). Mirrors the blocklist pattern in
 * the API moderation context: a thin DB-backed lookup used by the sign-in gate
 * in apps/server.
 */
import { eq } from "drizzle-orm";
import { alumni } from "@sip-and-speak/db/schema/alumni";

/**
 * Normalizes an email for registry storage and lookup: lowercased + trimmed.
 */
export function normalizeAlumniEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Checks whether the given email appears in the TU/e alumni registry.
 * Comparison is case-insensitive and strips surrounding whitespace.
 * Throws if the database is unreachable — callers gate on this (503).
 *
 * The `db` handle is imported lazily so this module can be loaded (e.g. for
 * `normalizeAlumniEmail` or the error constants) without triggering the
 * env-validated database connection.
 */
export async function isAlumniEmail(email: string): Promise<boolean> {
  const lower = normalizeAlumniEmail(email);
  if (!lower) return false;
  const { db } = await import("@sip-and-speak/db");
  const rows = await db
    .select({ id: alumni.id })
    .from(alumni)
    .where(eq(alumni.email, lower))
    .limit(1);
  return rows.length > 0;
}

export const ALUMNI_REGISTRY_ERROR =
  "Your email address was not found in the TU/e alumni registry. Please check your address or contact alumni@tue.nl for help.";

export const ALUMNI_REGISTRY_UNAVAILABLE_ERROR =
  "The alumni registry is temporarily unavailable. Please try again in a moment.";
