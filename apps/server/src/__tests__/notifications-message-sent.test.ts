/**
 * Tests for task #152 — Send push notification to recipient when a new message arrives
 * Tests for task #156 — Handle gracefully when recipient has not granted push permissions
 * Tests for task #154 — Include match identity in notification payload without message content
 *
 * Covers:
 *   - Recipient receives a push identifying the sender (no message content)
 *   - No push sent when recipient has no registered device token
 *   - DeviceNotRegistered receipt error is handled gracefully (stale token removed)
 *   - Notification payload shape: title = sender name, body = generic, conversationId in data
 */
import { describe, it, expect, mock, beforeEach } from "bun:test";

// ── Fetch mock ────────────────────────────────────────────────────────────────

interface CapturedFetchCall {
  url: string;
  messages: Array<{ to: string; title?: string; body?: string; data?: Record<string, unknown> }>;
}

const fetchCalls: CapturedFetchCall[] = [];
let mockFetchTickets: Array<{ status: string; id?: string; details?: { error?: string } }> = [
  { status: "ok", id: "ticket-1" },
];

(global as unknown as { fetch: unknown }).fetch = mock(async (url: string, options: RequestInit) => {
  fetchCalls.push({
    url,
    messages: JSON.parse(options.body as string) as CapturedFetchCall["messages"],
  });
  return {
    json: async () => ({ data: mockFetchTickets }),
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
const deletedTokenIds: string[] = [];

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
      where: (clause: { _val: string }) => {
        deletedTokenIds.push(clause._val);
        return Promise.resolve([]);
      },
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
  deletedTokenIds.length = 0;
  mockRecipientTokens = [];
  mockFetchTickets = [{ status: "ok", id: "ticket-1" }];
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
    // #154 — title is sender's display name; body is generic (no message content)
    expect(msg.title).toBe("Alice");
    expect(msg.body).toBe("sent you a message");
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

describe("#154 — Notification payload includes sender identity but not message content", () => {
  it("sets title to sender display name and body to a generic string", async () => {
    mockRecipientTokens = [{ id: "tok-1", token: "ExponentPushToken[recipient]" }];

    await handleMessageSent(makeMessageSentEvent({ senderName: "Bob" }));

    const msg = fetchCalls[0]?.messages[0];
    if (!msg) throw new Error("Expected a message");

    expect(msg.title).toBe("Bob");
    expect(msg.body).toBe("sent you a message");
  });

  it("payload contains conversationId for deep-linking", async () => {
    mockRecipientTokens = [{ id: "tok-1", token: "ExponentPushToken[recipient]" }];

    await handleMessageSent(makeMessageSentEvent({ conversationId: "conv-deep-link" }));

    const msg = fetchCalls[0]?.messages[0];
    if (!msg) throw new Error("Expected a message");

    expect(msg.data?.conversationId).toBe("conv-deep-link");
  });
});

describe("#156 — Handle gracefully when recipient has not granted push permissions", () => {
  it("removes stale token and does not throw when Expo returns DeviceNotRegistered", async () => {
    mockRecipientTokens = [{ id: "stale-tok-id", token: "ExponentPushToken[stale]" }];
    mockFetchTickets = [{ status: "error", details: { error: "DeviceNotRegistered" } }];

    await expect(handleMessageSent(makeMessageSentEvent())).resolves.toBeUndefined();

    expect(deletedTokenIds).toContain("stale-tok-id");
  });

  it("still resolves when fetch returns DeviceNotRegistered for all tokens", async () => {
    mockRecipientTokens = [{ id: "tok-bad", token: "ExponentPushToken[bad]" }];
    mockFetchTickets = [{ status: "error", details: { error: "DeviceNotRegistered" } }];

    // Second call — token already removed, no tokens left, so no push attempt
    mockRecipientTokens = [];

    await expect(handleMessageSent(makeMessageSentEvent())).resolves.toBeUndefined();
    expect(fetchCalls).toHaveLength(0);
  });
});
