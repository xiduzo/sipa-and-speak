/**
 * Integration tests for the chat read model (query side of the Conversation
 * context). Uses the in-memory pg-mem harness to seed conversations, messages,
 * and read-status rows, then asserts the list/unread shaping the chat router
 * delegates to — without driving the full tRPC procedure.
 */
import "../../../__test-support__/harness";

import { describe, it, expect, beforeEach } from "bun:test";

import { db } from "@sip-and-speak/db";
import { user } from "@sip-and-speak/db/schema/auth";
import {
  conversation,
  message,
  messageReadStatus,
} from "@sip-and-speak/db/schema/conversation";

import { resetDb } from "../../../__test-support__/harness";
import { listConversationsForUser, unreadCountForUser } from "../chat-read-model";

const T1 = new Date("2026-01-01T10:00:00Z");
const T2 = new Date("2026-01-02T10:00:00Z");
const T3 = new Date("2026-01-03T10:00:00Z");

async function seedUsers(ids: string[]): Promise<void> {
  await db.insert(user).values(
    ids.map((id) => ({
      id,
      name: id,
      email: `${id}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  );
}

describe("chat read model — listConversationsForUser", () => {
  beforeEach(() => {
    resetDb();
  });

  it("returns open conversations newest-activity-first, with partner + unread state", async () => {
    await seedUsers(["alice", "bob", "carol"]);
    await db.insert(conversation).values([
      { id: "conv-bob", user1Id: "alice", user2Id: "bob", createdAt: T1 },
      // alice is user2 here — partner resolution must still pick the other party.
      { id: "conv-carol", user1Id: "carol", user2Id: "alice", createdAt: T1 },
    ]);
    await db.insert(message).values([
      { conversationId: "conv-bob", senderId: "bob", content: "hi from bob", createdAt: T1 },
      { conversationId: "conv-carol", senderId: "carol", content: "hi from carol", createdAt: T2 },
    ]);

    const result = await listConversationsForUser("alice");

    // Sorted by last-message desc: carol (T2) before bob (T1).
    expect(result.map((c) => c.id)).toEqual(["conv-carol", "conv-bob"]);
    expect(result[0]!.partner).toEqual({ id: "carol", name: "carol", image: null });
    expect(result[1]!.partner).toEqual({ id: "bob", name: "bob", image: null });
    // No read record for alice → both unread.
    expect(result[0]!.hasUnread).toBe(true);
    expect(result[1]!.hasUnread).toBe(true);
  });

  it("clears hasUnread once lastReadAt is at/after the last message", async () => {
    await seedUsers(["alice", "bob"]);
    await db.insert(conversation).values({ id: "conv-bob", user1Id: "alice", user2Id: "bob", createdAt: T1 });
    await db.insert(message).values({ conversationId: "conv-bob", senderId: "bob", content: "hi", createdAt: T1 });
    await db.insert(messageReadStatus).values({ conversationId: "conv-bob", userId: "alice", lastReadAt: T2 });

    const [conv] = await listConversationsForUser("alice");
    expect(conv!.hasUnread).toBe(false);
  });

  it("excludes suspended conversations (#157)", async () => {
    await seedUsers(["alice", "bob", "carol"]);
    await db.insert(conversation).values([
      { id: "conv-open", user1Id: "alice", user2Id: "bob", status: "open", createdAt: T1 },
      { id: "conv-suspended", user1Id: "alice", user2Id: "carol", status: "suspended", createdAt: T1 },
    ]);

    const result = await listConversationsForUser("alice");
    expect(result.map((c) => c.id)).toEqual(["conv-open"]);
  });
});

describe("chat read model — unreadCountForUser", () => {
  beforeEach(() => {
    resetDb();
  });

  it("counts only conversations whose last message the user has not read", async () => {
    await seedUsers(["alice", "bob", "carol"]);
    await db.insert(conversation).values([
      { id: "conv-unread", user1Id: "alice", user2Id: "bob", createdAt: T1 },
      { id: "conv-read", user1Id: "alice", user2Id: "carol", createdAt: T1 },
      // No messages — must never count.
      { id: "conv-empty", user1Id: "alice", user2Id: "bob", createdAt: T1 },
    ]);
    await db.insert(message).values([
      { conversationId: "conv-unread", senderId: "bob", content: "unread", createdAt: T2 },
      { conversationId: "conv-read", senderId: "carol", content: "read", createdAt: T1 },
    ]);
    // alice has read conv-read through T3 (after its last message).
    await db.insert(messageReadStatus).values({ conversationId: "conv-read", userId: "alice", lastReadAt: T3 });

    expect(await unreadCountForUser("alice")).toEqual({ count: 1 });
  });
});
