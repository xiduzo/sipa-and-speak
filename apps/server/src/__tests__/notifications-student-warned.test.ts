/**
 * Tests for task #94 — Push notification on StudentWarned
 */
import { describe, it, expect, mock, beforeEach } from "bun:test";

interface CapturedFetchCall {
  url: string;
  messages: Array<{ to: string; title?: string; body?: string; data?: Record<string, unknown> }>;
}

const fetchCalls: CapturedFetchCall[] = [];
(global as unknown as { fetch: unknown }).fetch = mock(async (url: string, options: RequestInit) => {
  fetchCalls.push({ url, messages: JSON.parse(options.body as string) as CapturedFetchCall["messages"] });
  return { json: async () => ({ data: [{ status: "ok", id: "t-1" }] }) };
});

mock.module("@sip-and-speak/db/schema/sip-and-speak", () => ({ userDeviceToken: "userDeviceToken", userLanguage: "userLanguage", conversationPresence: "conversationPresence" }));
mock.module("@sip-and-speak/db/schema/auth", () => ({ user: "user" }));
mock.module("drizzle-orm", () => ({ eq: (_col: unknown, val: unknown) => ({ _val: val }), and: (...args: unknown[]) => ({ _args: args }) }));

let mockTokenRows: Array<{ id: string; token: string }> = [];
mock.module("@sip-and-speak/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => Promise.resolve(mockTokenRows) }) }),
  },
}));

import { registerNotificationHandlers } from "../notifications";
import { domainEvents } from "@sip-and-speak/api/domain-events";

describe("handleStudentWarned", () => {
  beforeEach(() => { fetchCalls.length = 0; mockTokenRows = []; domainEvents.removeAllListeners(); registerNotificationHandlers(); });

  it("sends push notification to warned Student's device", async () => {
    mockTokenRows = [{ id: "t-1", token: "ExponentPushToken[warned]" }];
    domainEvents.emit("StudentWarned", { flagId: "flag-1", targetId: "student-1", moderatorId: "mod-1", warnedAt: new Date() });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0]!.messages[0]!.to).toBe("ExponentPushToken[warned]");
    expect(fetchCalls[0]!.messages[0]!.title).toBe("Moderation notice");
    expect(fetchCalls[0]!.messages[0]!.data?.type).toBe("student_warned");
  });

  it("sends no notification when Student has no registered token", async () => {
    mockTokenRows = [];
    domainEvents.emit("StudentWarned", { flagId: "flag-2", targetId: "student-2", moderatorId: "mod-1", warnedAt: new Date() });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchCalls.length).toBe(0);
  });

  it("sends to all registered tokens when Student has multiple devices", async () => {
    mockTokenRows = [
      { id: "t-1", token: "ExponentPushToken[device1]" },
      { id: "t-2", token: "ExponentPushToken[device2]" },
    ];
    domainEvents.emit("StudentWarned", { flagId: "flag-3", targetId: "student-3", moderatorId: "mod-1", warnedAt: new Date() });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0]!.messages.length).toBe(2);
  });
});
