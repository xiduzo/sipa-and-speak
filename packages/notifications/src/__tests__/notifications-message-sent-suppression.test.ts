/**
 * Tests for task #153 — Suppress push notification when recipient is actively viewing
 *
 * The presence check runs in the conversation context before MessageSent is emitted.
 * The dispatcher reads event.recipientIsPresent and suppresses the push if true.
 *
 * Covers:
 *   - No push sent when recipientIsPresent is true
 *   - Push sent when recipientIsPresent is false
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

mock.module("@sip-and-speak/db/schema/identity", () => ({
  userDeviceToken: "userDeviceToken",
  userLanguage: "userLanguage",
}));

mock.module("@sip-and-speak/db/schema/auth", () => ({
  user: "user",
}));

// ── drizzle-orm mock ──────────────────────────────────────────────────────────

mock.module("drizzle-orm", () => ({
  eq: (_col: unknown, val: unknown) => ({ _col: _col, _val: val }),
  and: (...args: unknown[]) => ({ _and: args }),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────

const RECIPIENT_ID = "recipient-id";
const SENDER_ID = "sender-id";
const CONVERSATION_ID = "conv-1";

const RECIPIENT_TOKEN = [{ id: "tok-1", token: "ExponentPushToken[recipient]" }];

mock.module("@sip-and-speak/db", () => ({
  db: {
    select: (_fields: Record<string, unknown>) => ({
      from: (_table: unknown) => ({
        where: (_clause: unknown) => Promise.resolve(RECIPIENT_TOKEN),
      }),
    }),
    delete: (_table: unknown) => ({
      where: (_clause: unknown) => Promise.resolve([]),
    }),
  },
}));

// ── Import under test (after mocks) ──────────────────────────────────────────

// ── Domain events mock ────────────────────────────────────────────────────────

mock.module("@sip-and-speak/api/domain-events", () => ({
  domainEvents: { on: mock((_evt: string, _fn: unknown) => undefined), emit: mock(() => undefined), removeAllListeners: mock(() => undefined) },
}));

// eslint-disable-next-line import/first
import { handleMessageSent } from "../dispatcher";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(recipientIsPresent = false) {
  return {
    conversationId: CONVERSATION_ID,
    senderId: SENDER_ID,
    recipientId: RECIPIENT_ID,
    senderName: "Alice",
    recipientIsPresent,
  };
}

beforeEach(() => {
  fetchCalls.length = 0;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("#153 — Suppress push when recipient is actively viewing", () => {
  it("suppresses push when recipientIsPresent is true", async () => {
    await handleMessageSent(makeEvent(true));

    expect(fetchCalls).toHaveLength(0);
  });

  it("sends push when recipientIsPresent is false", async () => {
    await handleMessageSent(makeEvent(false));

    expect(fetchCalls).toHaveLength(1);
  });
});
