/**
 * Tests for task #83 — Push notification on MeetupCancelled
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

mock.module("@sip-and-speak/db/schema/sip-and-speak", () => ({ userDeviceToken: "userDeviceToken", userLanguage: "userLanguage" }));
mock.module("@sip-and-speak/db/schema/auth", () => ({ user: "user" }));
mock.module("drizzle-orm", () => ({ eq: (_col: unknown, val: unknown) => ({ _val: val }) }));

let mockTokenRows: Array<{ id: string; token: string }> = [];
mock.module("@sip-and-speak/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => Promise.resolve(mockTokenRows) }) }),
  },
}));

import { registerNotificationHandlers } from "../notifications";
import { domainEvents } from "@sip-and-speak/api/domain-events";

describe("handleMeetupCancelled", () => {
  beforeEach(() => { fetchCalls.length = 0; mockTokenRows = []; registerNotificationHandlers(); });

  it("notifies the other Student when a meetup is cancelled", async () => {
    mockTokenRows = [{ id: "t-1", token: "ExponentPushToken[other]" }];
    domainEvents.emit("MeetupCancelled", { meetupId: "m-1", cancelledById: "user-a", otherStudentId: "user-b", cancelledAt: new Date() });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0]!.messages[0]!.title).toBe("Meetup cancelled");
  });

  it("sends no notification when the other Student has no token", async () => {
    mockTokenRows = [];
    domainEvents.emit("MeetupCancelled", { meetupId: "m-2", cancelledById: "user-a", otherStudentId: "user-b", cancelledAt: new Date() });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchCalls.length).toBe(0);
  });
});
