/**
 * Tests for:
 *   task #102 — Cancel active proposals on Student suspension + notify peers
 *   task #104 — Notify suspended Student of the moderation decision
 *   task #106 — Notify Student when suspension is lifted
 *
 * The proposal cancellation (DB side) and peer-id resolution now live in the
 * moderation context handlers. The notifications package subscribes to
 * ProposalsCancelledByCascade (which carries peer IDs) instead of re-querying.
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

mock.module("@sip-and-speak/db/schema/identity", () => ({
  userDeviceToken: "userDeviceToken",
  userLanguage: "userLanguage",
}));
mock.module("@sip-and-speak/db/schema/auth", () => ({ user: "user" }));
mock.module("drizzle-orm", () => ({
  eq: (_col: unknown, val: unknown) => ({ _eq: val }),
  and: (...args: unknown[]) => ({ _and: args }),
  or: (...args: unknown[]) => ({ _or: args }),
  inArray: (_col: unknown, vals: unknown) => ({ _inArray: vals }),
}));

let mockTokenRows: Array<{ token: string }> = [];
let mockTokenRowsForSuspended: Array<{ token: string }> = [];

// Controls which token set is returned depending on query context.
// Peer tokens → mockTokenRows; suspended student tokens → mockTokenRowsForSuspended.
let returnPeerTokens = false;

mock.module("@sip-and-speak/db", () => ({
  db: {
    select: (_cols?: unknown) => ({
      from: (_table: unknown) => ({
        where: () => Promise.resolve(returnPeerTokens ? mockTokenRows : mockTokenRowsForSuspended),
      }),
    }),
  },
}));

// ── Domain events mock ────────────────────────────────────────────────────────

mock.module("@sip-and-speak/api/domain-events", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter } = require("events") as typeof import("events");
  return { domainEvents: new EventEmitter() };
});

import { registerNotificationHandlers } from "../dispatcher";
import { domainEvents } from "@sip-and-speak/api/domain-events";

describe("handleStudentSuspended — proposal cancellation (#102)", () => {
  beforeEach(() => {
    fetchCalls.length = 0;
    mockTokenRows = [];
    mockTokenRowsForSuspended = [];
    returnPeerTokens = false;
    domainEvents.removeAllListeners();
    registerNotificationHandlers();
  });

  it("notifies affected peer when proposal is cancelled", async () => {
    returnPeerTokens = true;
    mockTokenRows = [{ token: "ExponentPushToken[peer]" }];
    domainEvents.emit("ProposalsCancelledByCascade", { targetId: "student-1", peerIds: ["student-2"] });
    await new Promise((r) => setTimeout(r, 30));
    const proposalCancelMsg = fetchCalls.find((c) => c.messages[0]?.title === "Meetup proposal cancelled");
    expect(proposalCancelMsg).toBeDefined();
    expect(proposalCancelMsg!.messages[0]!.body).toBe("Your meetup proposal has been cancelled.");
  });

  it("notification does not reveal moderation reason", async () => {
    returnPeerTokens = true;
    mockTokenRows = [{ token: "ExponentPushToken[peer]" }];
    domainEvents.emit("ProposalsCancelledByCascade", { targetId: "student-1", peerIds: ["student-2"] });
    await new Promise((r) => setTimeout(r, 30));
    const proposalCancelMsg = fetchCalls.find((c) => c.messages[0]?.title === "Meetup proposal cancelled");
    expect(proposalCancelMsg!.messages[0]!.body).not.toContain("suspend");
    expect(proposalCancelMsg!.messages[0]!.body).not.toContain("moderation");
  });

  it("does not push proposal-cancelled when peerIds is empty", async () => {
    domainEvents.emit("ProposalsCancelledByCascade", { targetId: "student-1", peerIds: [] });
    await new Promise((r) => setTimeout(r, 30));
    const proposalCancelMsg = fetchCalls.find((c) => c.messages[0]?.title === "Meetup proposal cancelled");
    expect(proposalCancelMsg).toBeUndefined();
  });
});

describe("handleSuspensionLifted — notify Student (#106)", () => {
  beforeEach(() => {
    fetchCalls.length = 0;
    mockTokenRows = [];
    mockTokenRowsForSuspended = [];
    returnPeerTokens = false;
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
