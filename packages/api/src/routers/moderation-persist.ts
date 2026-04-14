/**
 * #72 — Persistence helpers for the flag submission flow.
 * Extracted for unit testing without requiring a live tRPC context.
 */
import { db } from "@sip-and-speak/db";
import { userFlag } from "@sip-and-speak/db/schema/sip-and-speak";
import { buildFlagValues } from "./moderation-utils";

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
