/**
 * Tests for task #77 — Push notification on MeetupDeclined
 *
 * Covers:
 *   - Both Students notified when a proposal is declined
 *   - No notification sent when neither Student has a device token
 */
import { describe, it, expect, mock, beforeEach } from "bun:test";

// ── Fetch mock ────────────────────────────────────────────────────────────────

interface CapturedFetchCall {
  url: string;
  messages: Array<{ to: string; title?: string; body?: string; data?: Record<string, unknown> }>;
}

const fetchCalls: CapturedFetchCall[] = [];

(global as unknown as { fetch: unknown }).fetch = mock(async (url: string, options: RequestInit) => {
  fetchCalls.push({
    url,
    messages: JSON.parse(options.body as string) as CapturedFetchCall["messages"],
  });
  return {
    json: async () => ({ data: [{ status: "ok", id: "ticket-1" }] }),
  };
});

// ── Schema mocks ──────────────────────────────────────────────────────────────

mock.module("@sip-and-speak/db/schema/sip-and-speak", () => ({
  userDeviceToken: "userDeviceToken",
  userLanguage: "userLanguage",
}));

mock.module("@sip-and-speak/db/schema/auth", () => ({
  user: "user",
}));

// ── drizzle-orm mock ──────────────────────────────────────────────────────────

mock.module("drizzle-orm", () => ({
  eq: (_col: unknown, val: unknown) => ({ _val: val }),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────

let proposerTokens: Array<{ id: string; token: string }> = [];
let receiverTokens: Array<{ id: string; token: string }> = [];
const PROPOSER_ID = "proposer-abc";
const RECEIVER_ID = "receiver-xyz";

mock.module("@sip-and-speak/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (clause: { _val: string }) => {
          const tokens = clause._val === PROPOSER_ID ? proposerTokens : receiverTokens;
          return Promise.resolve(tokens);
        },
      }),
    }),
  },
}));

// ── Subject under test ────────────────────────────────────────────────────────

import { registerNotificationHandlers } from "../notifications";
import { domainEvents } from "@sip-and-speak/api/domain-events";

describe("handleMeetupDeclined", () => {
  beforeEach(() => {
    fetchCalls.length = 0;
    proposerTokens = [];
    receiverTokens = [];
    registerNotificationHandlers();
  });

  it("notifies both Students when a proposal is declined", async () => {
    proposerTokens = [{ id: "pt-1", token: "ExponentPushToken[proposer-token]" }];
    receiverTokens = [{ id: "rt-1", token: "ExponentPushToken[receiver-token]" }];

    domainEvents.emit("MeetupDeclined", {
      meetupId: "meetup-1",
      proposerId: PROPOSER_ID,
      receiverId: RECEIVER_ID,
      declinedAt: new Date(),
    });

    await new Promise((r) => setTimeout(r, 20));

    expect(fetchCalls.length).toBe(1);
    const msgs = fetchCalls[0]!.messages;
    expect(msgs.length).toBe(2);
    expect(msgs.map((m) => m.to)).toContain("ExponentPushToken[proposer-token]");
    expect(msgs.map((m) => m.to)).toContain("ExponentPushToken[receiver-token]");
    expect(msgs[0]!.title).toBe("Meetup proposal declined");
  });

  it("sends no notification when neither Student has a device token", async () => {
    proposerTokens = [];
    receiverTokens = [];

    domainEvents.emit("MeetupDeclined", {
      meetupId: "meetup-2",
      proposerId: PROPOSER_ID,
      receiverId: RECEIVER_ID,
      declinedAt: new Date(),
    });

    await new Promise((r) => setTimeout(r, 20));

    expect(fetchCalls.length).toBe(0);
  });
});
