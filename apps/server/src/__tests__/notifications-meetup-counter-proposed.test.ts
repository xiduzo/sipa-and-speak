/**
 * Tests for task #76 — Push notification on MeetupCounterProposed
 *
 * Covers:
 *   - Original proposer (now the new receiver) notified when a counter-proposal arrives
 *   - No notification sent when the new receiver has no device token
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

let mockTokenRows: Array<{ id: string; token: string }> = [];
const ORIGINAL_PROPOSER_ID = "orig-proposer-123"; // becomes newReceiverId after counter

mock.module("@sip-and-speak/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(mockTokenRows),
      }),
    }),
  },
}));

// ── Subject under test ────────────────────────────────────────────────────────

import { registerNotificationHandlers } from "../notifications";
import { domainEvents } from "@sip-and-speak/api/domain-events";

describe("handleMeetupCounterProposed", () => {
  beforeEach(() => {
    fetchCalls.length = 0;
    mockTokenRows = [];
    registerNotificationHandlers();
  });

  it("notifies the original proposer (new receiver) of the counter-proposal", async () => {
    mockTokenRows = [{ id: "token-1", token: "ExponentPushToken[orig-proposer]" }];

    domainEvents.emit("MeetupCounterProposed", {
      meetupId: "meetup-1",
      newProposerId: "counter-proposer-456",
      newReceiverId: ORIGINAL_PROPOSER_ID,
      venueName: "Vertigo",
      date: "2026-05-15",
      time: "10:30",
      round: 2,
      counterProposedAt: new Date(),
    });

    await new Promise((r) => setTimeout(r, 20));

    expect(fetchCalls.length).toBe(1);
    const msg = fetchCalls[0]!.messages[0]!;
    expect(msg.to).toBe("ExponentPushToken[orig-proposer]");
    expect(msg.title).toContain("round 2");
    expect(msg.body).toContain("Vertigo");
  });

  it("sends no notification when new receiver has no device token", async () => {
    mockTokenRows = [];

    domainEvents.emit("MeetupCounterProposed", {
      meetupId: "meetup-2",
      newProposerId: "counter-proposer-456",
      newReceiverId: ORIGINAL_PROPOSER_ID,
      venueName: "Atlas",
      date: "2026-05-16",
      time: "11:00",
      round: 2,
      counterProposedAt: new Date(),
    });

    await new Promise((r) => setTimeout(r, 20));

    expect(fetchCalls.length).toBe(0);
  });
});
