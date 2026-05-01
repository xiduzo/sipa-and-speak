/**
 * Tests for handleStudentSuspendedSuspendConversations + handleSuspensionLiftedReopenConversations
 * — cascade conversation.status to "suspended" / "open" on moderation events.
 */
import { describe, it, expect, mock, beforeEach } from "bun:test";

(global as unknown as { fetch: unknown }).fetch = mock(async () => ({
  json: async () => ({ data: [{ status: "ok", id: "t-1" }] }),
}));

const dbUpdateCalls: Array<{ table: string; status: string }> = [];
let mockSelectRows: Array<{ id: string }> = [];

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
        where: () => Promise.resolve(mockSelectRows),
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

import { registerNotificationHandlers } from "../dispatcher";
import { domainEvents } from "@sip-and-speak/api/domain-events";

describe("handleStudentSuspendedSuspendConversations", () => {
  beforeEach(() => {
    dbUpdateCalls.length = 0;
    mockSelectRows = [];
    try { domainEvents.removeAllListeners(); } catch { /* suite-mode mock leak */ }
    registerNotificationHandlers();
  });

  it("sets conversation.status to 'suspended' when a Student is suspended", async () => {
    mockSelectRows = [{ id: "conv-1" }];
    domainEvents.emit("StudentSuspended", {
      flagId: "flag-1",
      targetId: "student-1",
      moderatorId: "mod-1",
      suspendedAt: new Date(),
    });
    await new Promise((r) => setTimeout(r, 30));
    const cascade = dbUpdateCalls.find((c) => c.table === "conversation" && c.status === "suspended");
    expect(cascade).toBeDefined();
  });

  it("does not update conversations when none are open", async () => {
    mockSelectRows = [];
    domainEvents.emit("StudentSuspended", {
      flagId: "flag-2",
      targetId: "student-2",
      moderatorId: "mod-1",
      suspendedAt: new Date(),
    });
    await new Promise((r) => setTimeout(r, 30));
    const cascade = dbUpdateCalls.find((c) => c.table === "conversation");
    expect(cascade).toBeUndefined();
  });
});

describe("handleSuspensionLiftedReopenConversations", () => {
  beforeEach(() => {
    dbUpdateCalls.length = 0;
    mockSelectRows = [];
    try { domainEvents.removeAllListeners(); } catch { /* suite-mode mock leak */ }
    registerNotificationHandlers();
  });

  it("sets conversation.status back to 'open' when suspension is lifted", async () => {
    mockSelectRows = [{ id: "conv-1" }];
    domainEvents.emit("SuspensionLifted", {
      targetId: "student-1",
      moderatorId: "mod-1",
      liftedAt: new Date(),
    });
    await new Promise((r) => setTimeout(r, 30));
    const reopen = dbUpdateCalls.find((c) => c.table === "conversation" && c.status === "open");
    expect(reopen).toBeDefined();
  });

  it("does not update when no suspended conversations exist", async () => {
    mockSelectRows = [];
    domainEvents.emit("SuspensionLifted", {
      targetId: "student-2",
      moderatorId: "mod-1",
      liftedAt: new Date(),
    });
    await new Promise((r) => setTimeout(r, 30));
    const reopen = dbUpdateCalls.find((c) => c.table === "conversation");
    expect(reopen).toBeUndefined();
  });
});
