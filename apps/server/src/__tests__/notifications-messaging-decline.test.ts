/**
 * Tests for task #142 — Notify both Students when messaging channel won't open (decline outcome)
 */
import { describe, it, expect, mock, beforeEach } from "bun:test";

interface CapturedFetchCall {
  url: string;
  messages: Array<{ to: string; title?: string; body?: string; data?: Record<string, unknown> }>;
}
const fetchCalls: CapturedFetchCall[] = [];

(global as unknown as { fetch: unknown }).fetch = mock(async (url: string, options: RequestInit) => {
  fetchCalls.push({ url, messages: JSON.parse(options.body as string) as CapturedFetchCall["messages"] });
  return { json: async () => ({ data: [{ status: "ok", id: "ticket-1" }] }) };
});

mock.module("@sip-and-speak/db/schema/sip-and-speak", () => ({ userDeviceToken: "userDeviceToken", userLanguage: "userLanguage" }));
mock.module("@sip-and-speak/db/schema/auth", () => ({ user: "user" }));
mock.module("drizzle-orm", () => ({ eq: (_col: unknown, val: unknown) => ({ _val: val }), or: (...args: unknown[]) => args }));

const STUDENT_A_ID = "student-a-id";
const STUDENT_B_ID = "student-b-id";

let mockStudentATokens: Array<{ id: string; token: string }> = [];
let mockStudentBTokens: Array<{ id: string; token: string }> = [];

mock.module("@sip-and-speak/db", () => ({
  db: {
    select: (_fields: Record<string, unknown>) => ({
      from: (_t: unknown) => ({
        where: (clause: { _val: string }) => {
          const rows = clause._val === STUDENT_A_ID ? mockStudentATokens : mockStudentBTokens;
          return Promise.resolve(rows);
        },
      }),
    }),
  },
}));

mock.module("@sip-and-speak/api/domain-events", () => ({
  domainEvents: { on: mock(() => undefined), emit: mock(() => undefined) },
}));

// eslint-disable-next-line import/first
import { handleMessagingDeclineOutcome } from "../notifications";

beforeEach(() => {
  fetchCalls.length = 0;
  mockStudentATokens = [];
  mockStudentBTokens = [];
});

describe("#142 — Notify both Students on decline outcome", () => {
  it("sends decline notification to both Students", async () => {
    mockStudentATokens = [{ id: "tok-a", token: "ExponentPushToken[alice]" }];
    mockStudentBTokens = [{ id: "tok-b", token: "ExponentPushToken[bob]" }];

    await handleMessagingDeclineOutcome({ meetupId: "meetup-1", studentAId: STUDENT_A_ID, studentBId: STUDENT_B_ID });

    expect(fetchCalls).toHaveLength(1);
    const msgs = fetchCalls[0]!.messages;
    expect(msgs).toHaveLength(2);
    const tokens = msgs.map((m) => m.to);
    expect(tokens).toContain("ExponentPushToken[alice]");
    expect(tokens).toContain("ExponentPushToken[bob]");
    msgs.forEach((m) => {
      expect(m.title).toBe("Messaging not available");
      expect(m.data?.type).toBe("messaging_decline_outcome");
    });
  });

  it("sends no notification when neither Student has a device token", async () => {
    await handleMessagingDeclineOutcome({ meetupId: "meetup-1", studentAId: STUDENT_A_ID, studentBId: STUDENT_B_ID });
    expect(fetchCalls).toHaveLength(0);
  });
});
