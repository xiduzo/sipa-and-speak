/**
 * Tests for task #140 — Send second push to pending Student when their match accepts
 *
 * Covers:
 *   - Pending Student receives a nudge push when their match accepts
 *   - No nudge sent when pending Student has no device token
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
  or: (...args: unknown[]) => args,
}));

// ── DB mock ───────────────────────────────────────────────────────────────────

const ACCEPTING_STUDENT_ID = "student-a-id";
const PENDING_STUDENT_ID = "student-b-id";

let mockAcceptingStudentTokens: Array<{ id: string; token: string }> = [];
let mockPendingStudentTokens: Array<{ id: string; token: string }> = [];

const ACCEPTING_STUDENT_NAME = [{ name: "Alice" }];

mock.module("@sip-and-speak/db", () => ({
  db: {
    select: (fields: Record<string, unknown>) => {
      const isNameQuery = "name" in fields;
      return {
        from: (_table: unknown) => ({
          where: (clause: { _val: string }) => {
            if (isNameQuery) {
              const rows = clause._val === ACCEPTING_STUDENT_ID ? ACCEPTING_STUDENT_NAME : [];
              return { limit: (_n: number) => Promise.resolve(rows) };
            }
            const rows =
              clause._val === ACCEPTING_STUDENT_ID
                ? mockAcceptingStudentTokens
                : mockPendingStudentTokens;
            return Promise.resolve(rows);
          },
        }),
      };
    },
  },
}));

// ── Domain events mock ────────────────────────────────────────────────────────

mock.module("@sip-and-speak/api/domain-events", () => ({
  domainEvents: { on: mock((_evt: string, _fn: unknown) => undefined), emit: mock(() => undefined) },
}));

// ── Import under test (after mocks) ──────────────────────────────────────────

// eslint-disable-next-line import/first
import { handleMessagingNudge } from "../notifications";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNudgeEvent(
  overrides: Partial<{
    meetupId: string;
    acceptingStudentId: string;
    pendingStudentId: string;
  }> = {},
) {
  return {
    meetupId: overrides.meetupId ?? "meetup-1",
    acceptingStudentId: overrides.acceptingStudentId ?? ACCEPTING_STUDENT_ID,
    pendingStudentId: overrides.pendingStudentId ?? PENDING_STUDENT_ID,
  };
}

beforeEach(() => {
  fetchCalls.length = 0;
  mockAcceptingStudentTokens = [];
  mockPendingStudentTokens = [];
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("#140 — Send second push to pending Student when their match accepts", () => {
  it("sends a nudge push to the pending Student with the accepting Student's name", async () => {
    mockPendingStudentTokens = [{ id: "tok-b", token: "ExponentPushToken[bob]" }];

    await handleMessagingNudge(makeNudgeEvent());

    expect(fetchCalls).toHaveLength(1);

    const call = fetchCalls[0];
    if (!call) throw new Error("Expected a fetch call");

    expect(call.messages).toHaveLength(1);
    const msg = call.messages[0];
    if (!msg) throw new Error("Expected a message");

    expect(msg.to).toBe("ExponentPushToken[bob]");
    expect(msg.title).toBe("Your match wants to message you!");
    expect(msg.body).toContain("Alice");
    expect(msg.data?.type).toBe("messaging_nudge");
    expect(msg.data?.meetupId).toBe("meetup-1");
  });

  it("sends no notification when pending Student has no registered device token", async () => {
    mockPendingStudentTokens = [];

    await handleMessagingNudge(makeNudgeEvent());

    expect(fetchCalls).toHaveLength(0);
  });
});
