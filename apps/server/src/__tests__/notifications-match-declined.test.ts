/**
 * Tests for task #135 — Push notification on MatchRequestDeclined
 *
 * Covers:
 *   - Notification sent to requester when their match request is declined
 *   - Notification body does not identify the declining receiver
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

let mockTokenRows: Array<{ id: string; token: string }> = [];

mock.module("@sip-and-speak/db", () => ({
  db: {
    select: (_fields: Record<string, unknown>) => ({
      from: (_table: unknown) => ({
        where: (_cond: unknown) => ({
          limit: (_n: number) => Promise.resolve(mockTokenRows),
          then: (
            resolve: (v: unknown) => unknown,
            reject?: (e: unknown) => unknown,
          ) => Promise.resolve(mockTokenRows).then(resolve, reject),
        }),
      }),
    }),
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
import { handleMatchRequestDeclined } from "../notifications";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDeclinedEvent(
  overrides: Partial<{ requesterId: string; receiverId: string; matchRequestId: string }> = {},
) {
  return {
    matchRequestId: overrides.matchRequestId ?? "req-456",
    requesterId: overrides.requesterId ?? "requester-id",
    receiverId: overrides.receiverId ?? "receiver-id",
    declinedAt: new Date(),
  };
}

beforeEach(() => {
  fetchCalls.length = 0;
  mockTokenRows = [];
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("#135 — Push notification on MatchRequestDeclined", () => {
  it("sends a push notification to the requester when their request is declined", async () => {
    mockTokenRows = [{ id: "tok-2", token: "ExponentPushToken[def]" }];

    await handleMatchRequestDeclined(makeDeclinedEvent());

    expect(fetchCalls).toHaveLength(1);

    const call = fetchCalls[0];
    if (!call) throw new Error("Expected a fetch call");

    expect(call.url).toBe("https://exp.host/--/api/v2/push/send");
    expect(call.messages).toHaveLength(1);

    const msg = call.messages[0];
    if (!msg) throw new Error("Expected a message");

    expect(msg.to).toBe("ExponentPushToken[def]");
    expect(msg.title).toBe("Your match request was not accepted");
    expect(msg.data?.type).toBe("match_declined");
    expect(msg.data?.matchRequestId).toBe("req-456");
  });

  it("does not include the receiver's name in the notification body", async () => {
    mockTokenRows = [{ id: "tok-2", token: "ExponentPushToken[def]" }];

    await handleMatchRequestDeclined(makeDeclinedEvent({ receiverId: "receiver-xyz" }));

    const msg = fetchCalls[0]?.messages[0];
    if (!msg) throw new Error("Expected a message");

    // Body must not reference the receiver identity — privacy invariant
    expect(msg.body).not.toContain("receiver-xyz");
    expect(msg.body).toBeTruthy();
  });

  it("does not send a push notification when the requester has no registered device token", async () => {
    mockTokenRows = [];

    await handleMatchRequestDeclined(makeDeclinedEvent());

    expect(fetchCalls).toHaveLength(0);
  });
});
