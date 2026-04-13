/**
 * Tests for task #75 — Push notification on MeetupConfirmed
 *
 * Covers:
 *   - Both Students notified when a meetup is confirmed
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

const DEVICE_TOKEN_TABLE = "userDeviceToken";

mock.module("@sip-and-speak/db/schema/sip-and-speak", () => ({
  userDeviceToken: DEVICE_TOKEN_TABLE,
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

// Track which userId is queried to return the right tokens
let proposerTokens: Array<{ id: string; token: string }> = [];
let receiverTokens: Array<{ id: string; token: string }> = [];
let lastQueriedUserId = "";
const PROPOSER_ID = "proposer-123";
const RECEIVER_ID = "receiver-456";

mock.module("@sip-and-speak/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (clause: { _val: string }) => {
          lastQueriedUserId = clause._val;
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

describe("handleMeetupConfirmed", () => {
  beforeEach(() => {
    fetchCalls.length = 0;
    proposerTokens = [];
    receiverTokens = [];
    registerNotificationHandlers();
  });

  it("notifies both Students when a meetup is confirmed", async () => {
    proposerTokens = [{ id: "pt-1", token: "ExponentPushToken[proposer-token]" }];
    receiverTokens = [{ id: "rt-1", token: "ExponentPushToken[receiver-token]" }];

    domainEvents.emit("MeetupConfirmed", {
      meetupId: "meetup-1",
      proposerId: PROPOSER_ID,
      receiverId: RECEIVER_ID,
      venueName: "Atlas Building",
      date: "2026-05-10",
      time: "14:00",
      confirmedAt: new Date(),
    });

    // Allow async handler to flush
    await new Promise((r) => setTimeout(r, 20));

    expect(fetchCalls.length).toBe(1);
    const sentMessages = fetchCalls[0]!.messages;
    expect(sentMessages.length).toBe(2);
    expect(sentMessages.map((m) => m.to)).toContain("ExponentPushToken[proposer-token]");
    expect(sentMessages.map((m) => m.to)).toContain("ExponentPushToken[receiver-token]");
    expect(sentMessages[0]!.title).toBe("Meetup confirmed! 🎉");
    expect(sentMessages[0]!.body).toContain("Atlas Building");
  });

  it("sends no notification when neither Student has a device token", async () => {
    proposerTokens = [];
    receiverTokens = [];

    domainEvents.emit("MeetupConfirmed", {
      meetupId: "meetup-2",
      proposerId: PROPOSER_ID,
      receiverId: RECEIVER_ID,
      venueName: "Flux",
      date: "2026-05-11",
      time: "10:00",
      confirmedAt: new Date(),
    });

    await new Promise((r) => setTimeout(r, 20));

    expect(fetchCalls.length).toBe(0);
  });
});
