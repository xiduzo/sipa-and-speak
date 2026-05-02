/**
 * Tests for #347 — Push notification on MatchRequestSent
 *
 * Covers:
 *   - Notification sent to receiver when a match request is sent to them
 *   - No notification sent when receiver has no registered device token
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

const USER_TABLE = "user";
const DEVICE_TOKEN_TABLE = "userDeviceToken";

mock.module("@sip-and-speak/db/schema/identity", () => ({
  userDeviceToken: DEVICE_TOKEN_TABLE,
  userLanguage: "userLanguage",
}));

mock.module("@sip-and-speak/db/schema/auth", () => ({
  user: USER_TABLE,
}));

// ── drizzle-orm mock ──────────────────────────────────────────────────────────

mock.module("drizzle-orm", () => ({
  eq: (_col: unknown, val: unknown) => ({ _val: val }),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────

let mockReceiverRows: Array<{ name: string }> = [{ name: "Bob" }];
let mockTokenRows: Array<{ id: string; token: string }> = [];

mock.module("@sip-and-speak/db", () => ({
  db: {
    select: (fields: Record<string, unknown>) => {
      const isNameQuery = "name" in fields;
      return {
        from: (_table: unknown) => {
          const rows = isNameQuery ? mockReceiverRows : mockTokenRows;
          return {
            where: (_cond: unknown) => ({
              limit: (_n: number) => Promise.resolve(rows),
              then: (
                resolve: (v: unknown) => unknown,
                reject?: (e: unknown) => unknown,
              ) => Promise.resolve(rows).then(resolve, reject),
            }),
          };
        },
      };
    },
    delete: (_table: unknown) => ({
      where: (_cond: unknown) => Promise.resolve(),
    }),
  },
}));

// ── Domain events mock ────────────────────────────────────────────────────────

mock.module("@sip-and-speak/api/domain-events", () => ({
  domainEvents: { on: mock((_evt: string, _fn: unknown) => undefined), emit: mock(() => undefined), removeAllListeners: mock(() => undefined) },
}));

// ── Import under test (after mocks) ──────────────────────────────────────────

// eslint-disable-next-line import/first
import { handleMatchRequestSent } from "../dispatcher";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSentEvent(
  overrides: Partial<{
    matchRequestId: string;
    requesterId: string;
    requesterName: string;
    receiverId: string;
    offeredLanguage: string | null;
    targetedLanguage: string | null;
  }> = {},
) {
  return {
    matchRequestId: overrides.matchRequestId ?? "req-456",
    requesterId: overrides.requesterId ?? "requester-id",
    requesterName: overrides.requesterName ?? "Alice",
    receiverId: overrides.receiverId ?? "receiver-id",
    offeredLanguage: overrides.offeredLanguage ?? "English",
    targetedLanguage: overrides.targetedLanguage ?? "Dutch",
    sentAt: new Date(),
  };
}

beforeEach(() => {
  fetchCalls.length = 0;
  mockReceiverRows = [{ name: "Bob" }];
  mockTokenRows = [];
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("#347 — Push notification on MatchRequestSent", () => {
  it("sends a push notification to the receiver when a match request is sent", async () => {
    mockTokenRows = [{ id: "tok-1", token: "ExponentPushToken[xyz]" }];

    await handleMatchRequestSent(makeSentEvent());

    expect(fetchCalls).toHaveLength(1);

    const call = fetchCalls[0];
    if (!call) throw new Error("Expected a fetch call");

    expect(call.url).toBe("https://exp.host/--/api/v2/push/send");
    expect(call.messages).toHaveLength(1);

    const msg = call.messages[0];
    if (!msg) throw new Error("Expected a message");

    expect(msg.to).toBe("ExponentPushToken[xyz]");
    expect(msg.title).toBe("New match request");
    expect(msg.data?.matchRequestId).toBe("req-456");
    expect(msg.data?.requesterId).toBe("requester-id");
  });

  it("does not send a push notification when the receiver has no registered device token", async () => {
    mockTokenRows = [];

    await handleMatchRequestSent(makeSentEvent());

    expect(fetchCalls).toHaveLength(0);
  });
});
