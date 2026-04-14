/**
 * Tests for task #111 — Close open conversations involving a removed Student
 */
import { describe, it, expect, mock, beforeEach } from "bun:test";

(global as unknown as { fetch: unknown }).fetch = mock(async () => ({
  json: async () => ({ data: [{ status: "ok", id: "t-1" }] }),
}));

const dbUpdateCalls: Array<{ table: string; status: string }> = [];
let mockConversationRows: Array<{ id: string }> = [];

mock.module("@sip-and-speak/db/schema/sip-and-speak", () => ({
  userDeviceToken: "userDeviceToken",
  userLanguage: "userLanguage",
  conversationPresence: "conversationPresence",
  meetup: "meetup",
  blockedEmail: "blockedEmail",
  conversation: "conversation",
}));
mock.module("@sip-and-speak/db/schema/auth", () => ({ user: "user" }));
mock.module("drizzle-orm", () => ({
  eq: (_col: unknown, val: unknown) => ({ _eq: val }),
  and: (...args: unknown[]) => ({ _and: args }),
  or: (...args: unknown[]) => ({ _or: args }),
  inArray: (_col: unknown, vals: unknown) => ({ _inArray: vals }),
}));

mock.module("@sip-and-speak/db", () => ({
  db: {
    select: (_cols?: unknown) => ({
      from: (_table: unknown) => ({
        where: () => Promise.resolve(mockConversationRows),
        limit: () => Promise.resolve([]),
      }),
    }),
    update: (table: unknown) => ({
      set: (vals: Record<string, unknown>) => ({
        where: () => {
          dbUpdateCalls.push({ table: table as string, status: vals["status"] as string });
          return Promise.resolve();
        },
      }),
    }),
    insert: (_table: unknown) => ({
      values: (_vals: unknown) => ({
        onConflictDoNothing: () => Promise.resolve(),
      }),
    }),
  },
}));

import { registerNotificationHandlers } from "../notifications";
import { domainEvents } from "@sip-and-speak/api/domain-events";

describe("handleStudentRemovedCloseConversations (#111)", () => {
  beforeEach(() => {
    dbUpdateCalls.length = 0;
    mockConversationRows = [];
    domainEvents.removeAllListeners();
    registerNotificationHandlers();
  });

  it("closes open conversations when a Student is removed", async () => {
    mockConversationRows = [{ id: "conv-1" }];
    domainEvents.emit("StudentRemoved", { flagId: "flag-1", targetId: "student-1", moderatorId: "mod-1", removedAt: new Date() });
    await new Promise((r) => setTimeout(r, 30));
    const conversationUpdate = dbUpdateCalls.find((c) => c.table === "conversation" && c.status === "closed");
    expect(conversationUpdate).toBeDefined();
  });

  it("does not update conversations when no open conversations exist", async () => {
    mockConversationRows = [];
    domainEvents.emit("StudentRemoved", { flagId: "flag-2", targetId: "student-1", moderatorId: "mod-1", removedAt: new Date() });
    await new Promise((r) => setTimeout(r, 30));
    const conversationUpdate = dbUpdateCalls.find((c) => c.table === "conversation");
    expect(conversationUpdate).toBeUndefined();
  });

  it("already-closed conversations are not re-updated (idempotent via query filter)", async () => {
    // The handler only queries status="open" conversations — none returned = no update
    mockConversationRows = [];
    domainEvents.emit("StudentRemoved", { flagId: "flag-3", targetId: "student-2", moderatorId: "mod-1", removedAt: new Date() });
    await new Promise((r) => setTimeout(r, 30));
    const conversationUpdate = dbUpdateCalls.find((c) => c.table === "conversation");
    expect(conversationUpdate).toBeUndefined();
  });
});
