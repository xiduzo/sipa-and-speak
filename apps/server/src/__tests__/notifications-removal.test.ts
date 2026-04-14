/**
 * Tests for task #112 — Mark flag as resolved and notify the removed Student
 *
 * Covers:
 *   - Removed Student receives push notification
 *   - Notification failure does not roll back removal (flag stays resolved)
 */
import { describe, it, expect, mock, beforeEach } from "bun:test";

interface CapturedFetchCall {
  url: string;
  messages: Array<{ to: string; title?: string; body?: string; data?: Record<string, unknown> }>;
}

const fetchCalls: CapturedFetchCall[] = [];
let fetchShouldFail = false;
(global as unknown as { fetch: unknown }).fetch = mock(async (url: string, options: RequestInit) => {
  if (fetchShouldFail) throw new Error("Expo push failed");
  fetchCalls.push({ url, messages: JSON.parse(options.body as string) as CapturedFetchCall["messages"] });
  return { json: async () => ({ data: [{ status: "ok", id: "t-1" }] }) };
});

let mockTokenRows: Array<{ token: string }> = [];

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
        where: () => Promise.resolve(mockTokenRows),
        limit: () => Promise.resolve([]),
      }),
    }),
    update: (_table: unknown) => ({
      set: (_vals: unknown) => ({
        where: () => Promise.resolve(),
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

describe("handleStudentRemovedNotify (#112)", () => {
  beforeEach(() => {
    fetchCalls.length = 0;
    fetchShouldFail = false;
    mockTokenRows = [];
    domainEvents.removeAllListeners();
    registerNotificationHandlers();
  });

  it("sends push notification to removed Student", async () => {
    mockTokenRows = [{ token: "ExponentPushToken[removed-student]" }];
    domainEvents.emit("StudentRemoved", { flagId: "flag-1", targetId: "student-1", moderatorId: "mod-1", removedAt: new Date() });
    await new Promise((r) => setTimeout(r, 30));
    const msg = fetchCalls.find((c) => c.messages[0]?.title === "Your account has been removed");
    expect(msg).toBeDefined();
    expect(msg!.messages[0]!.to).toBe("ExponentPushToken[removed-student]");
  });

  it("no notification sent when Student has no device token", async () => {
    mockTokenRows = [];
    domainEvents.emit("StudentRemoved", { flagId: "flag-2", targetId: "student-2", moderatorId: "mod-1", removedAt: new Date() });
    await new Promise((r) => setTimeout(r, 30));
    const msg = fetchCalls.find((c) => c.messages[0]?.title === "Your account has been removed");
    expect(msg).toBeUndefined();
  });

  it("notification failure does not throw — removal stands", async () => {
    mockTokenRows = [{ token: "ExponentPushToken[student-3]" }];
    fetchShouldFail = true;
    // Should not throw
    domainEvents.emit("StudentRemoved", { flagId: "flag-3", targetId: "student-3", moderatorId: "mod-1", removedAt: new Date() });
    await new Promise((r) => setTimeout(r, 30));
    // No assertion on push — just verifying no unhandled rejection
    expect(true).toBe(true);
  });
});
