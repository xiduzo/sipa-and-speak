/**
 * Tests for task #152 — Send push notification to recipient when a new message arrives
 *
 * Covers:
 *   - Recipient receives a push identifying the sender (no message content)
 *   - No push sent when recipient has no registered device token
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

const SENDER_ID = "sender-id";
const RECIPIENT_ID = "recipient-id";

let mockRecipientTokens: Array<{ id: string; token: string }> = [];

mock.module("@sip-and-speak/db", () => ({
  db: {
    select: (_fields: Record<string, unknown>) => ({
      from: (_table: unknown) => ({
        where: (clause: { _val: string }) => {
          const rows = clause._val === RECIPIENT_ID ? mockRecipientTokens : [];
          return Promise.resolve(rows);
        },
      }),
    }),
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

function makeMessageSentEvent(
  overrides: Partial<{
    conversationId: string;
    senderId: string;
    recipientId: string;
    senderName: string;
  }> = {},
) {
  return {
    conversationId: overrides.conversationId ?? "conv-1",
    senderId: overrides.senderId ?? SENDER_ID,
    recipientId: overrides.recipientId ?? RECIPIENT_ID,
    senderName: overrides.senderName ?? "Alice",
  };
}

beforeEach(() => {
  fetchCalls.length = 0;
  mockRecipientTokens = [];
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("#152 — Send push notification to recipient when a new message arrives", () => {
  it("sends a push to the recipient identifying the sender without message content", async () => {
    mockRecipientTokens = [{ id: "tok-1", token: "ExponentPushToken[recipient]" }];

    await handleMessageSent(makeMessageSentEvent());

    expect(fetchCalls).toHaveLength(1);

    const call = fetchCalls[0];
    if (!call) throw new Error("Expected a fetch call");

    expect(call.messages).toHaveLength(1);
    const msg = call.messages[0];
    if (!msg) throw new Error("Expected a message");

    expect(msg.to).toBe("ExponentPushToken[recipient]");
    expect(msg.title).toContain("Alice");
    expect(msg.body).toBeUndefined();
    expect(msg.data?.type).toBe("message_received");
    expect(msg.data?.conversationId).toBe("conv-1");
    expect(msg.data?.senderId).toBe(SENDER_ID);
  });

  it("sends no notification when recipient has no registered device token", async () => {
    mockRecipientTokens = [];

    await handleMessageSent(makeMessageSentEvent());

    expect(fetchCalls).toHaveLength(0);
  });
});
