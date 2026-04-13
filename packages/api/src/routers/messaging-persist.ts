/**
 * #145 — Persistence helpers for the messaging send flow.
 * Extracted for unit testing without requiring a live tRPC context.
 */
import { db } from "@sip-and-speak/db";
import { message } from "@sip-and-speak/db/schema/sip-and-speak";

export interface PersistMessageInput {
  conversationId: string;
  senderId: string;
  content: string;
}

/**
 * Inserts a message row and returns the created record.
 * Throws on DB failure — no partial record is created.
 */
export async function persistMessage(input: PersistMessageInput) {
  const [created] = await db
    .insert(message)
    .values({
      conversationId: input.conversationId,
      senderId: input.senderId,
      content: input.content,
    })
    .returning();

  return created!;
}
