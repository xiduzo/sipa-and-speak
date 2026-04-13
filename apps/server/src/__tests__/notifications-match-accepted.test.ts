/**
 * Tests for task #134 — Push notification on MatchRequestAccepted
 *
 * Covers:
 *   - Notification sent to requester when their match request is accepted
 *   - No notification sent when requester has no registered device token
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

mock.module("@sip-and-speak/db/schema/sip-and-speak", () => ({
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

let mockReceiverRows: Array<{ name: string }> = [{ name: "Alice" }];
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
  domainEvents: { on: mock((_evt: string, _fn: unknown) => undefined), emit: mock(() => undefined) },
}));

// ── Import under test (after mocks) ──────────────────────────────────────────

// eslint-disable-next-line import/first
import { handleMatchRequestAccepted } from "../notifications";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAcceptedEvent(
  overrides: Partial<{ requesterId: string; receiverId: string; matchRequestId: string }> = {},
) {
  return {
    matchRequestId: overrides.matchRequestId ?? "req-123",
    requesterId: overrides.requesterId ?? "requester-id",
    receiverId: overrides.receiverId ?? "receiver-id",
    acceptedAt: new Date(),
  };
}

beforeEach(() => {
  fetchCalls.length = 0;
  mockReceiverRows = [{ name: "Alice" }];
  mockTokenRows = [];
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("#134 — Push notification on MatchRequestAccepted", () => {
  it("sends a push notification to the requester when their request is accepted", async () => {
    mockTokenRows = [{ id: "tok-1", token: "ExponentPushToken[abc]" }];

    await handleMatchRequestAccepted(makeAcceptedEvent());

    expect(fetchCalls).toHaveLength(1);

    const call = fetchCalls[0];
    if (!call) throw new Error("Expected a fetch call");

    expect(call.url).toBe("https://exp.host/--/api/v2/push/send");
    expect(call.messages).toHaveLength(1);

    const msg = call.messages[0];
    if (!msg) throw new Error("Expected a message");

    expect(msg.to).toBe("ExponentPushToken[abc]");
    expect(msg.title).toBe("Your match request was accepted!");
    expect(msg.data?.type).toBe("match_accepted");
    expect(msg.data?.matchRequestId).toBe("req-123");
  });

  it("does not send a push notification when the requester has no registered device token", async () => {
    mockTokenRows = [];

    await handleMatchRequestAccepted(makeAcceptedEvent());

    expect(fetchCalls).toHaveLength(0);
  });
});
