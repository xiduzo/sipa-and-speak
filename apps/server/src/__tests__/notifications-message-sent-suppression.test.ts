/**
 * Tests for task #153 — Suppress push notification when recipient is actively viewing
 *
 * Covers:
 *   - No push sent when recipient has an active (non-stale) presence record
 *   - Push sent when recipient is not viewing (no presence record)
 *   - Push sent when presence record is stale (activeUntil in the past)
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
const PRESENCE_TABLE = "conversationPresence";

mock.module("@sip-and-speak/db/schema/sip-and-speak", () => ({
  userDeviceToken: DEVICE_TOKEN_TABLE,
  conversationPresence: PRESENCE_TABLE,
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

// Presence record control — null means no record
let mockPresence: { activeUntil: Date } | null = null;

mock.module("@sip-and-speak/db", () => ({
  db: {
    select: (fields: Record<string, unknown>) => {
      const isPresenceQuery = "activeUntil" in fields;
      return {
        from: (_table: unknown) => ({
          where: (_clause: unknown) => {
            if (isPresenceQuery) {
              return {
                limit: (_n: number) => Promise.resolve(mockPresence ? [mockPresence] : []),
              };
            }
            // Token query — always return recipient token for simplicity
            return Promise.resolve(RECIPIENT_TOKEN);
          },
        }),
      };
    },
    delete: (_table: unknown) => ({
      where: (_clause: unknown) => Promise.resolve([]),
    }),
  },
}));

// ── Domain events mock ────────────────────────────────────────────────────────

mock.module("@sip-and-speak/api/domain-events", () => ({
  domainEvents: { on: mock((_evt: string, _fn: unknown) => undefined), emit: mock(() => undefined) },
}));

// ── Import under test (after mocks) ──────────────────────────────────────────

// eslint-disable-next-line import/first
import { handleMessageSent } from "../notifications";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent() {
  return {
    conversationId: CONVERSATION_ID,
    senderId: SENDER_ID,
    recipientId: RECIPIENT_ID,
    senderName: "Alice",
  };
}

beforeEach(() => {
  fetchCalls.length = 0;
  mockPresence = null;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("#153 — Suppress push when recipient is actively viewing", () => {
  it("suppresses push when recipient has an active presence record", async () => {
    mockPresence = { activeUntil: new Date(Date.now() + 30_000) };

    await handleMessageSent(makeEvent());

    expect(fetchCalls).toHaveLength(0);
  });

  it("sends push when recipient is not viewing (no presence record)", async () => {
    mockPresence = null;

    await handleMessageSent(makeEvent());

    expect(fetchCalls).toHaveLength(1);
  });

  it("sends push when recipient presence record is stale (activeUntil in past)", async () => {
    mockPresence = { activeUntil: new Date(Date.now() - 1_000) };

    await handleMessageSent(makeEvent());

    expect(fetchCalls).toHaveLength(1);
  });
});
