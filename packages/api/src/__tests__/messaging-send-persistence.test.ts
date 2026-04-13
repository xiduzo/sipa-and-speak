/**
 * Tests for task #145 — Persist and deliver message to recipient
 *
 * Covers:
 *   - Message insert is called with correct conversationId, senderId, content
 *   - Created message row is returned to sender
 *   - DB error propagates (no partial record created)
 */
import { describe, it, expect, mock, beforeEach } from "bun:test";

// ── drizzle-orm mock (must be before any imports that use it) ─────────────────

mock.module("drizzle-orm", () => ({
  eq: (_col: unknown, val: unknown) => ({ _eq: val }),
  and: (...args: unknown[]) => args,
  isNull: () => ({ _isNull: true }),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────

const insertedRows: Array<{ conversationId: string; senderId: string; content: string }> = [];
let dbError: Error | null = null;

mock.module("@sip-and-speak/db", () => ({
  db: {
    insert: (_table: unknown) => ({
      values: (row: { conversationId: string; senderId: string; content: string }) => ({
        returning: () => {
          if (dbError) return Promise.reject(dbError);
          const created = { id: "msg-1", createdAt: new Date(), ...row };
          insertedRows.push(row);
          return Promise.resolve([created]);
        },
      }),
    }),
  },
}));

mock.module("@sip-and-speak/db/schema/sip-and-speak", () => ({
  message: "message",
  conversation: "conversation",
  meetup: "meetup",
  messagingOptIn: "messagingOptIn",
}));

// ── Import under test (after mocks) ──────────────────────────────────────────

import { persistMessage } from "../routers/messaging-persist";

beforeEach(() => {
  insertedRows.length = 0;
  dbError = null;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("#145 — persistMessage", () => {
  it("inserts message with correct fields and returns the created row", async () => {
    const result = await persistMessage({
      conversationId: "conv-1",
      senderId: "alice",
      content: "Hello Bob!",
    });

    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({
      conversationId: "conv-1",
      senderId: "alice",
      content: "Hello Bob!",
    });
    expect(result.id).toBe("msg-1");
    expect(result.content).toBe("Hello Bob!");
  });

  it("propagates DB error without creating a partial record", async () => {
    dbError = new Error("DB connection lost");

    await expect(
      persistMessage({ conversationId: "conv-1", senderId: "alice", content: "Hi" }),
    ).rejects.toThrow("DB connection lost");

    expect(insertedRows).toHaveLength(0);
  });
});
