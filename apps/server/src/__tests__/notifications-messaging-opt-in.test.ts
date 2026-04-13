/**
 * Tests for task #138 — Send opt-in push notification to both Students after meetup is completed
 *
 * Covers:
 *   - Both Students receive an opt-in prompt when their meetup is completed
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

const STUDENT_A_ID = "student-a-id";
const STUDENT_B_ID = "student-b-id";

let mockStudentATokens: Array<{ id: string; token: string }> = [];
let mockStudentBTokens: Array<{ id: string; token: string }> = [];

const STUDENT_A_NAME = [{ name: "Alice" }];
const STUDENT_B_NAME = [{ name: "Bob" }];

mock.module("@sip-and-speak/db", () => ({
  db: {
    select: (fields: Record<string, unknown>) => {
      const isNameQuery = "name" in fields;
      return {
        from: (_table: unknown) => ({
          where: (clause: { _val: string }) => {
            if (isNameQuery) {
              const rows = clause._val === STUDENT_A_ID ? STUDENT_A_NAME : STUDENT_B_NAME;
              return { limit: (_n: number) => Promise.resolve(rows) };
            }
            const rows = clause._val === STUDENT_A_ID ? mockStudentATokens : mockStudentBTokens;
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
import { handleMessagingOptInPrompted } from "../notifications";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeOptInEvent(
  overrides: Partial<{ meetupId: string; studentAId: string; studentBId: string }> = {},
) {
  return {
    meetupId: overrides.meetupId ?? "meetup-1",
    studentAId: overrides.studentAId ?? STUDENT_A_ID,
    studentBId: overrides.studentBId ?? STUDENT_B_ID,
    promptedAt: new Date(),
  };
}

beforeEach(() => {
  fetchCalls.length = 0;
  mockStudentATokens = [];
  mockStudentBTokens = [];
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("#138 — Send opt-in push notification to both Students after meetup is completed", () => {
  it("sends an opt-in push to both Students when their meetup is completed", async () => {
    mockStudentATokens = [{ id: "tok-a", token: "ExponentPushToken[alice]" }];
    mockStudentBTokens = [{ id: "tok-b", token: "ExponentPushToken[bob]" }];

    await handleMessagingOptInPrompted(makeOptInEvent());

    expect(fetchCalls).toHaveLength(1);

    const call = fetchCalls[0];
    if (!call) throw new Error("Expected a fetch call");

    expect(call.messages).toHaveLength(2);

    const tokens = call.messages.map((m) => m.to);
    expect(tokens).toContain("ExponentPushToken[alice]");
    expect(tokens).toContain("ExponentPushToken[bob]");

    // Student A (Alice) sees Bob's name
    const aliceMsg = call.messages.find((m) => m.to === "ExponentPushToken[alice]");
    expect(aliceMsg?.title).toBe("Want to keep in touch?");
    expect(aliceMsg?.body).toContain("Bob");
    expect(aliceMsg?.data?.type).toBe("messaging_opt_in");
    expect(aliceMsg?.data?.meetupId).toBe("meetup-1");

    // Student B (Bob) sees Alice's name
    const bobMsg = call.messages.find((m) => m.to === "ExponentPushToken[bob]");
    expect(bobMsg?.title).toBe("Want to keep in touch?");
    expect(bobMsg?.body).toContain("Alice");
    expect(bobMsg?.data?.type).toBe("messaging_opt_in");
    expect(bobMsg?.data?.meetupId).toBe("meetup-1");
  });

  it("sends no notification when neither Student has a registered device token", async () => {
    mockStudentATokens = [];
    mockStudentBTokens = [];

    await handleMessagingOptInPrompted(makeOptInEvent());

    expect(fetchCalls).toHaveLength(0);
  });
});
