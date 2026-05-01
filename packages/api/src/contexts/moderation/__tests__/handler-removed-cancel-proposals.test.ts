/**
 * Tests for task #110 — Cancel active meetup proposals on removal and notify affected Students
 */
import { describe, it, expect, mock, beforeEach } from "bun:test";

interface CapturedFetchCall {
  url: string;
  messages: Array<{ to: string; title?: string; body?: string; data?: Record<string, unknown> }>;
}

const fetchCalls: CapturedFetchCall[] = [];
(global as unknown as { fetch: unknown }).fetch = mock(async (url: string, options: RequestInit) => {
  fetchCalls.push({ url, messages: JSON.parse(options.body as string) as CapturedFetchCall["messages"] });
  return { json: async () => ({ data: [{ status: "ok", id: "t-1" }] }) };
});

const dbUpdateCalls: Array<{ table: string; status: string }> = [];

mock.module("@sip-and-speak/db/schema/sip-and-speak", () => ({
  userDeviceToken: "userDeviceToken",
  userLanguage: "userLanguage",
  conversationPresence: "conversationPresence",
  meetup: "meetup",
  blockedEmail: "blockedEmail",
}));
mock.module("@sip-and-speak/db/schema/auth", () => ({ user: "user" }));
mock.module("drizzle-orm", () => ({
  eq: (_col: unknown, val: unknown) => ({ _eq: val }),
  and: (...args: unknown[]) => ({ _and: args }),
  or: (...args: unknown[]) => ({ _or: args }),
  inArray: (_col: unknown, vals: unknown) => ({ _inArray: vals }),
}));

let mockMeetupRows: Array<{ id: string; proposerId: string; receiverId: string }> = [];
let mockTokenRows: Array<{ token: string }> = [];

mock.module("@sip-and-speak/db", () => ({
  db: {
    select: (cols?: unknown) => {
      const hasId = cols && typeof cols === "object" && "id" in (cols as object);
      return {
        from: (_table: unknown) => ({
          where: () => {
            const rows = hasId ? mockMeetupRows : mockTokenRows;
            const p = Promise.resolve(rows) as Promise<unknown> & { limit: (n: number) => Promise<unknown> };
            p.limit = () => Promise.resolve([]);
            return p;
          },
          limit: () => Promise.resolve([]),
        }),
      };
    },
    update: (_table: unknown) => ({
      set: (_vals: unknown) => ({
        where: () => {
          dbUpdateCalls.push({ table: "meetup", status: "cancelled" });
          return Promise.resolve();
        },
      }),
    }),
    insert: (_table: unknown) => ({
      values: (_vals: unknown) => ({
        onConflictDoNothing: () => Promise.resolve(),
      }),
    }),
  },
}));

import { registerModerationHandlers } from "../handlers";
import { domainEvents } from "../../../domain-events";

describe("handleStudentRemovedCancelProposals (#110) — DB cascade", () => {
  beforeEach(() => {
    fetchCalls.length = 0;
    dbUpdateCalls.length = 0;
    mockMeetupRows = [];
    mockTokenRows = [];
    domainEvents.removeAllListeners();
    registerModerationHandlers();
  });

  it("cancels active proposals when a Student is removed", async () => {
    mockMeetupRows = [{ id: "m-1", proposerId: "student-1", receiverId: "student-2" }];
    mockTokenRows = [{ token: "ExponentPushToken[peer]" }];
    domainEvents.emit("StudentRemoved", { flagId: "flag-1", targetId: "student-1", moderatorId: "mod-1", removedAt: new Date() });
    await new Promise((r) => setTimeout(r, 30));
    const meetupCancel = dbUpdateCalls.find((c) => c.table === "meetup" && c.status === "cancelled");
    expect(meetupCancel).toBeDefined();
  });

  it("completed proposals not affected (no active proposals → no update)", async () => {
    mockMeetupRows = [];
    domainEvents.emit("StudentRemoved", { flagId: "flag-2", targetId: "student-1", moderatorId: "mod-1", removedAt: new Date() });
    await new Promise((r) => setTimeout(r, 30));
    const meetupCancel = dbUpdateCalls.find((c) => c.table === "meetup");
    expect(meetupCancel).toBeUndefined();
  });
});
