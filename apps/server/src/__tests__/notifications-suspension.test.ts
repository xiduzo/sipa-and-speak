/**
 * Tests for:
 *   task #102 — Cancel active proposals on Student suspension + notify peers
 *   task #104 — Notify suspended Student of the moderation decision
 *   task #106 — Notify Student when suspension is lifted
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

// Track DB update calls for proposal cancellation
const dbUpdateCalls: Array<{ table: string; status: string }> = [];

mock.module("@sip-and-speak/db/schema/sip-and-speak", () => ({
  userDeviceToken: "userDeviceToken",
  userLanguage: "userLanguage",
  conversationPresence: "conversationPresence",
  meetup: "meetup",
}));
mock.module("@sip-and-speak/db/schema/auth", () => ({ user: "user" }));
mock.module("drizzle-orm", () => ({
  eq: (_col: unknown, val: unknown) => ({ _eq: val }),
  and: (...args: unknown[]) => ({ _and: args }),
  or: (...args: unknown[]) => ({ _or: args }),
  inArray: (_col: unknown, vals: unknown) => ({ _inArray: vals }),
}));

// Rows returned by meetup select (active proposals)
let mockMeetupRows: Array<{ id: string; proposerId: string; receiverId: string }> = [];
// Rows returned by device token select
let mockTokenRows: Array<{ token: string }> = [];
let mockTokenRowsForSuspended: Array<{ token: string }> = [];

mock.module("@sip-and-speak/db", () => ({
  db: {
    select: (cols?: unknown) => {
      // Distinguish based on field shape — crude but effective for unit tests
      const hasId = cols && typeof cols === "object" && "id" in (cols as object);
      return {
        from: (_table: unknown) => ({
          where: () => {
            if (hasId) {
              // meetup select (has `id` field)
              return Promise.resolve(mockMeetupRows);
            }
            // Alternate between "for peer tokens" and "for suspended student tokens"
            // by returning mockTokenRows (peer) when mockMeetupRows is non-empty
            return Promise.resolve(mockMeetupRows.length > 0 ? mockTokenRows : mockTokenRowsForSuspended);
          },
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
  },
}));

import { registerNotificationHandlers } from "../notifications";
import { domainEvents } from "@sip-and-speak/api/domain-events";

describe("handleStudentSuspended — proposal cancellation (#102)", () => {
  beforeEach(() => {
    fetchCalls.length = 0;
    dbUpdateCalls.length = 0;
    mockMeetupRows = [];
    mockTokenRows = [];
    mockTokenRowsForSuspended = [];
    domainEvents.removeAllListeners();
    registerNotificationHandlers();
  });

  it("cancels active proposals when a Student is suspended", async () => {
    mockMeetupRows = [{ id: "m-1", proposerId: "student-1", receiverId: "student-2" }];
    mockTokenRows = [{ token: "ExponentPushToken[peer]" }];
    domainEvents.emit("StudentSuspended", { flagId: "flag-1", targetId: "student-1", moderatorId: "mod-1", suspendedAt: new Date() });
    await new Promise((r) => setTimeout(r, 30));
    expect(dbUpdateCalls.length).toBeGreaterThan(0);
    expect(dbUpdateCalls[0]!.status).toBe("cancelled");
  });

  it("notifies affected peer when proposal is cancelled", async () => {
    mockMeetupRows = [{ id: "m-1", proposerId: "student-1", receiverId: "student-2" }];
    mockTokenRows = [{ token: "ExponentPushToken[peer]" }];
    domainEvents.emit("StudentSuspended", { flagId: "flag-1", targetId: "student-1", moderatorId: "mod-1", suspendedAt: new Date() });
    await new Promise((r) => setTimeout(r, 30));
    const proposalCancelMsg = fetchCalls.find((c) => c.messages[0]?.title === "Meetup proposal cancelled");
    expect(proposalCancelMsg).toBeDefined();
    expect(proposalCancelMsg!.messages[0]!.body).toBe("Your meetup proposal has been cancelled.");
  });

  it("notification does not reveal moderation reason", async () => {
    mockMeetupRows = [{ id: "m-1", proposerId: "student-1", receiverId: "student-2" }];
    mockTokenRows = [{ token: "ExponentPushToken[peer]" }];
    domainEvents.emit("StudentSuspended", { flagId: "flag-1", targetId: "student-1", moderatorId: "mod-1", suspendedAt: new Date() });
    await new Promise((r) => setTimeout(r, 30));
    const proposalCancelMsg = fetchCalls.find((c) => c.messages[0]?.title === "Meetup proposal cancelled");
    expect(proposalCancelMsg!.messages[0]!.body).not.toContain("suspend");
    expect(proposalCancelMsg!.messages[0]!.body).not.toContain("moderation");
  });

  it("does nothing when Student has no active proposals", async () => {
    mockMeetupRows = [];
    domainEvents.emit("StudentSuspended", { flagId: "flag-2", targetId: "student-1", moderatorId: "mod-1", suspendedAt: new Date() });
    await new Promise((r) => setTimeout(r, 30));
    expect(dbUpdateCalls.length).toBe(0);
  });
});

describe("handleSuspensionLifted — notify Student (#106)", () => {
  beforeEach(() => {
    fetchCalls.length = 0;
    mockMeetupRows = [];
    mockTokenRows = [];
    mockTokenRowsForSuspended = [];
    domainEvents.removeAllListeners();
    registerNotificationHandlers();
  });

  it("notifies Student when suspension is lifted", async () => {
    mockTokenRowsForSuspended = [{ token: "ExponentPushToken[student]" }];
    domainEvents.emit("SuspensionLifted", { targetId: "student-1", moderatorId: "mod-1", liftedAt: new Date() });
    await new Promise((r) => setTimeout(r, 30));
    const liftedMsg = fetchCalls.find((c) => c.messages[0]?.title === "Suspension lifted");
    expect(liftedMsg).toBeDefined();
  });

  it("sends no notification when Student has no device token", async () => {
    mockTokenRowsForSuspended = [];
    domainEvents.emit("SuspensionLifted", { targetId: "student-2", moderatorId: "mod-1", liftedAt: new Date() });
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchCalls.filter((c) => c.messages[0]?.title === "Suspension lifted").length).toBe(0);
  });
});
