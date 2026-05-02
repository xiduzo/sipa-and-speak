/**
 * Tests for the DB-cascade portion of #102 — cancel active proposals when
 * a Student is suspended. The push side (notifying the affected peer) is
 * tested in @sip-and-speak/notifications.
 */
import { describe, it, expect, mock, beforeEach } from "bun:test";

(global as unknown as { fetch: unknown }).fetch = mock(async () => ({
  json: async () => ({ data: [{ status: "ok", id: "t-1" }] }),
}));

const dbUpdateCalls: Array<{ table: string; status: string }> = [];
let mockMeetupRows: Array<{ id: string; proposerId: string; receiverId: string }> = [];

mock.module("@sip-and-speak/db/schema/scheduling", () => ({ meetup: "meetup" }));
mock.module("@sip-and-speak/db/schema/conversation", () => ({ conversation: "conversation" }));
mock.module("@sip-and-speak/db/schema/auth", () => ({ user: "user" }));
mock.module("drizzle-orm", () => ({
  eq: (_col: unknown, val: unknown) => ({ _eq: val }),
  and: (...args: unknown[]) => ({ _and: args }),
  or: (...args: unknown[]) => ({ _or: args }),
  inArray: (_col: unknown, vals: unknown) => ({ _inArray: vals }),
}));

mock.module("@sip-and-speak/db", () => ({
  db: {
    select: (_cols?: unknown) => ({
      from: (_table: unknown) => ({
        where: () => {
          const p = Promise.resolve(mockMeetupRows) as Promise<unknown> & { limit: (n: number) => Promise<unknown> };
          p.limit = () => Promise.resolve([]);
          return p;
        },
        limit: () => Promise.resolve([]),
      }),
    }),
    update: (table: unknown) => ({
      set: (vals: Record<string, unknown>) => ({
        where: () => {
          dbUpdateCalls.push({ table: table as string, status: vals["status"] as string });
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

describe("handleStudentSuspendedCancelProposals (#102) — DB cascade", () => {
  beforeEach(() => {
    dbUpdateCalls.length = 0;
    mockMeetupRows = [];
    domainEvents.removeAllListeners();
    registerModerationHandlers();
  });

  it("cancels active proposals when a Student is suspended", async () => {
    mockMeetupRows = [{ id: "m-1", proposerId: "student-1", receiverId: "student-2" }];
    domainEvents.emit("StudentSuspended", { flagId: "flag-1", targetId: "student-1", moderatorId: "mod-1", suspendedAt: new Date() });
    await new Promise((r) => setTimeout(r, 30));
    const meetupCancel = dbUpdateCalls.find((c) => c.table === "meetup" && c.status === "cancelled");
    expect(meetupCancel).toBeDefined();
  });

  it("does nothing when Student has no active proposals", async () => {
    mockMeetupRows = [];
    domainEvents.emit("StudentSuspended", { flagId: "flag-2", targetId: "student-1", moderatorId: "mod-1", suspendedAt: new Date() });
    await new Promise((r) => setTimeout(r, 30));
    const meetupCancel = dbUpdateCalls.find((c) => c.table === "meetup");
    expect(meetupCancel).toBeUndefined();
  });
});
