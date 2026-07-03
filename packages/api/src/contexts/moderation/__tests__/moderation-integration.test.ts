/**
 * Integration tests for the moderation status procedures (suspendStudent,
 * liftSuspension, removeStudent, suspendUser, removeUser) using the in-memory
 * pg-mem harness: input → router → StudentAccount aggregate → commitAndEmit →
 * DB writes + emitted domain events.
 *
 * The flag-driven procedures write user.studentStatus and the userFlag
 * resolution in one `commitAndEmit` unit of work; these tests cover the
 * happy-path writes + events. pg-mem does not emulate transactional rollback
 * (see ADR-0002), so partial-failure rollback itself is not asserted here —
 * it is a Postgres guarantee routed through the single `commitAndEmit` seam.
 *
 * The harness registers TEST_MODERATOR_EMAIL on the MODERATOR_EMAILS
 * allowlist before any router module evaluates, so the moderator caller
 * passes the moderatorProcedure gate.
 */
import "../../../__test-support__/harness";

import { describe, it, expect, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";

import { db } from "@sip-and-speak/db";
import { user } from "@sip-and-speak/db/schema/auth";
import { userFlag, blockedEmail } from "@sip-and-speak/db/schema/moderation";
import { meetup, venue } from "@sip-and-speak/db/schema/scheduling";
import { conversation } from "@sip-and-speak/db/schema/conversation";

import { appRouter } from "../../../routers";
import {
  resetDb,
  buildSessionContext,
  captureEvents,
  TEST_MODERATOR_EMAIL,
} from "../../../__test-support__/harness";
import { registerModerationHandlers } from "../handlers";
import { domainEvents } from "../../../domain-events";

const MOD_ID = "u-mod";
const TARGET_ID = "u-target";
const PEER_ID = "u-peer";

function moderatorCaller() {
  return appRouter.createCaller(buildSessionContext(MOD_ID, TEST_MODERATOR_EMAIL));
}

async function seedUsers(targetStatus: "active" | "suspended" | "removed" = "active") {
  // pg-mem cannot mix explicit values and `default` for the same column across
  // rows of one multi-row insert — set studentStatus explicitly on every row.
  await db.insert(user).values([
    { id: MOD_ID, name: "Mod", email: TEST_MODERATOR_EMAIL, emailVerified: true, studentStatus: "active", createdAt: new Date(), updatedAt: new Date() },
    { id: TARGET_ID, name: "Target", email: "target@example.com", emailVerified: true, studentStatus: targetStatus, createdAt: new Date(), updatedAt: new Date() },
    { id: PEER_ID, name: "Peer", email: "peer@example.com", emailVerified: true, studentStatus: "active", createdAt: new Date(), updatedAt: new Date() },
  ]);
}

async function seedOpenFlag(): Promise<string> {
  const [flag] = await db
    .insert(userFlag)
    .values({ reporterId: PEER_ID, targetId: TARGET_ID, reason: "SPAM", status: "open" })
    .returning();
  return flag!.id;
}

async function loadTargetStatus(): Promise<string | null> {
  const [row] = await db
    .select({ studentStatus: user.studentStatus })
    .from(user)
    .where(eq(user.id, TARGET_ID))
    .limit(1);
  return row?.studentStatus ?? null;
}

async function loadFlag(flagId: string) {
  const [row] = await db
    .select({
      status: userFlag.status,
      outcome: userFlag.outcome,
      moderatorId: userFlag.moderatorId,
      resolvedAt: userFlag.resolvedAt,
    })
    .from(userFlag)
    .where(eq(userFlag.id, flagId))
    .limit(1);
  return row;
}

async function trpcCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (err) {
    return (err as { code: string }).code;
  }
  throw new Error("expected the call to throw");
}

describe("moderation integration — suspendStudent", () => {
  beforeEach(() => {
    resetDb();
    domainEvents.removeAllListeners();
  });

  it("suspends the student, resolves the flag, emits StudentSuspended after commit", async () => {
    await seedUsers();
    const flagId = await seedOpenFlag();
    const capture = captureEvents();

    const result = await moderatorCaller().moderation.suspendStudent({ flagId });

    expect(result).toEqual({ success: true });
    expect(await loadTargetStatus()).toBe("suspended");
    const flag = await loadFlag(flagId);
    expect(flag!.status).toBe("resolved");
    expect(flag!.outcome).toBe("suspended");
    expect(flag!.moderatorId).toBe(MOD_ID);
    expect(flag!.resolvedAt).not.toBeNull();

    const suspended = capture.events.filter((e) => e.name === "StudentSuspended");
    expect(suspended).toHaveLength(1);
    expect(suspended[0]!.payload).toMatchObject({
      flagId,
      targetId: TARGET_ID,
      moderatorId: MOD_ID,
    });
    capture.stop();
  });

  it("rejects an unknown flag with NOT_FOUND", async () => {
    await seedUsers();
    expect(
      await trpcCode(moderatorCaller().moderation.suspendStudent({ flagId: "nope" })),
    ).toBe("NOT_FOUND");
  });

  it("rejects an already-suspended student with CONFLICT (unified guard)", async () => {
    await seedUsers("suspended");
    const flagId = await seedOpenFlag();
    expect(
      await trpcCode(moderatorCaller().moderation.suspendStudent({ flagId })),
    ).toBe("CONFLICT");
    // guard failure writes nothing
    expect((await loadFlag(flagId))!.status).toBe("open");
  });

  it("rejects a removed student with BAD_REQUEST (unified guard)", async () => {
    await seedUsers("removed");
    const flagId = await seedOpenFlag();
    expect(
      await trpcCode(moderatorCaller().moderation.suspendStudent({ flagId })),
    ).toBe("BAD_REQUEST");
    expect(await loadTargetStatus()).toBe("removed");
  });
});

describe("moderation integration — liftSuspension", () => {
  beforeEach(() => {
    resetDb();
    domainEvents.removeAllListeners();
  });

  it("re-activates a suspended student and emits SuspensionLifted", async () => {
    await seedUsers("suspended");
    const capture = captureEvents();

    await moderatorCaller().moderation.liftSuspension({ targetId: TARGET_ID });

    expect(await loadTargetStatus()).toBe("active");
    const lifted = capture.events.filter((e) => e.name === "SuspensionLifted");
    expect(lifted).toHaveLength(1);
    expect(lifted[0]!.payload).toMatchObject({ targetId: TARGET_ID, moderatorId: MOD_ID });
    capture.stop();
  });

  it("rejects a non-suspended student with BAD_REQUEST", async () => {
    await seedUsers("active");
    expect(
      await trpcCode(moderatorCaller().moderation.liftSuspension({ targetId: TARGET_ID })),
    ).toBe("BAD_REQUEST");
  });
});

describe("moderation integration — removeStudent", () => {
  beforeEach(() => {
    resetDb();
    domainEvents.removeAllListeners();
  });

  it("removes the student, resolves the flag, emits StudentRemoved after commit", async () => {
    await seedUsers();
    const flagId = await seedOpenFlag();
    const capture = captureEvents();

    await moderatorCaller().moderation.removeStudent({ flagId });

    expect(await loadTargetStatus()).toBe("removed");
    const flag = await loadFlag(flagId);
    expect(flag!.status).toBe("resolved");
    expect(flag!.outcome).toBe("removed");

    const removed = capture.events.filter((e) => e.name === "StudentRemoved");
    expect(removed).toHaveLength(1);
    expect(removed[0]!.payload).toMatchObject({
      flagId,
      targetId: TARGET_ID,
      moderatorId: MOD_ID,
    });
    capture.stop();
  });

  it("is idempotent: already-removed student → success, flag untouched, no event", async () => {
    await seedUsers("removed");
    const flagId = await seedOpenFlag();
    const capture = captureEvents();

    const result = await moderatorCaller().moderation.removeStudent({ flagId });

    expect(result).toEqual({ success: true });
    expect((await loadFlag(flagId))!.status).toBe("open");
    expect(capture.events.filter((e) => e.name === "StudentRemoved")).toHaveLength(0);
    capture.stop();
  });
});

describe("moderation integration — direct admin actions (suspendUser / removeUser)", () => {
  beforeEach(() => {
    resetDb();
    domainEvents.removeAllListeners();
  });

  it("suspendUser suspends and emits StudentSuspended with flagId null", async () => {
    await seedUsers();
    const capture = captureEvents();

    await moderatorCaller().moderation.suspendUser({ targetId: TARGET_ID });

    expect(await loadTargetStatus()).toBe("suspended");
    const suspended = capture.events.filter((e) => e.name === "StudentSuspended");
    expect(suspended).toHaveLength(1);
    expect(suspended[0]!.payload).toMatchObject({ flagId: null, targetId: TARGET_ID });
    capture.stop();
  });

  it("suspendUser rejects removed → BAD_REQUEST, suspended → CONFLICT", async () => {
    await seedUsers("removed");
    expect(
      await trpcCode(moderatorCaller().moderation.suspendUser({ targetId: TARGET_ID })),
    ).toBe("BAD_REQUEST");

    resetDb();
    await seedUsers("suspended");
    expect(
      await trpcCode(moderatorCaller().moderation.suspendUser({ targetId: TARGET_ID })),
    ).toBe("CONFLICT");
  });

  it("removeUser removes, emits StudentRemoved with flagId null, and is idempotent", async () => {
    await seedUsers();
    const capture = captureEvents();

    await moderatorCaller().moderation.removeUser({ targetId: TARGET_ID });
    expect(await loadTargetStatus()).toBe("removed");
    expect(capture.events.filter((e) => e.name === "StudentRemoved")).toHaveLength(1);

    // second call: no-op success, no second event
    const again = await moderatorCaller().moderation.removeUser({ targetId: TARGET_ID });
    expect(again).toEqual({ success: true });
    expect(capture.events.filter((e) => e.name === "StudentRemoved")).toHaveLength(1);
    capture.stop();
  });
});

describe("moderation integration — cascade handlers (against pg-mem)", () => {
  beforeEach(() => {
    resetDb();
    domainEvents.removeAllListeners();
  });

  /** Handlers are fire-and-forget; give the event loop a few ticks. */
  const settleCascade = () => new Promise((r) => setTimeout(r, 50));

  async function seedMeetup(status: "confirmed" | "pending" | "completed" = "confirmed") {
    const [v] = await db
      .insert(venue)
      .values({ name: "Cafe Test", latitude: 51.4, longitude: 5.45, isActive: true })
      .returning();
    const [m] = await db
      .insert(meetup)
      .values({
        proposerId: TARGET_ID,
        receiverId: PEER_ID,
        venueId: v!.id,
        scheduledAt: new Date("2099-01-01T18:00:00Z"),
        status,
      })
      .returning();
    return m!.id;
  }

  async function seedConversation(status: "open" | "suspended" | "closed" = "open") {
    const [c] = await db
      .insert(conversation)
      .values({ user1Id: TARGET_ID, user2Id: PEER_ID, status })
      .returning();
    return c!.id;
  }

  async function meetupStatus(id: string) {
    const [row] = await db.select({ status: meetup.status }).from(meetup).where(eq(meetup.id, id));
    return row!.status;
  }

  async function conversationStatus(id: string) {
    const [row] = await db
      .select({ status: conversation.status })
      .from(conversation)
      .where(eq(conversation.id, id));
    return row!.status;
  }

  it("suspendUser cascades: active proposals cancelled, open conversations suspended, ProposalsCancelledByCascade emitted", async () => {
    await seedUsers();
    const meetupId = await seedMeetup("confirmed");
    const conversationId = await seedConversation("open");

    registerModerationHandlers();
    const capture = captureEvents();

    await moderatorCaller().moderation.suspendUser({ targetId: TARGET_ID });
    await settleCascade();

    expect(await meetupStatus(meetupId)).toBe("cancelled");
    expect(await conversationStatus(conversationId)).toBe("suspended");

    const cascades = capture.events.filter((e) => e.name === "ProposalsCancelledByCascade");
    expect(cascades).toHaveLength(1);
    expect(cascades[0]!.payload).toEqual({ targetId: TARGET_ID, peerIds: [PEER_ID] });
    capture.stop();
  });

  it("suspension cascade leaves completed meetups alone and emits no ProposalsCancelledByCascade", async () => {
    await seedUsers();
    const meetupId = await seedMeetup("completed");

    registerModerationHandlers();
    const capture = captureEvents();

    await moderatorCaller().moderation.suspendUser({ targetId: TARGET_ID });
    await settleCascade();

    expect(await meetupStatus(meetupId)).toBe("completed");
    expect(
      capture.events.filter((e) => e.name === "ProposalsCancelledByCascade"),
    ).toHaveLength(0);
    capture.stop();
  });

  it("liftSuspension cascade re-opens suspended conversations, leaves closed ones", async () => {
    await seedUsers("suspended");
    const suspendedConv = await seedConversation("suspended");
    const closedConv = await seedConversation("closed");

    registerModerationHandlers();

    await moderatorCaller().moderation.liftSuspension({ targetId: TARGET_ID });
    await settleCascade();

    expect(await conversationStatus(suspendedConv)).toBe("open");
    expect(await conversationStatus(closedConv)).toBe("closed");
  });

  it("removeUser cascades: proposals cancelled, conversations closed, email blocklisted", async () => {
    await seedUsers();
    const meetupId = await seedMeetup("pending");
    const conversationId = await seedConversation("open");

    registerModerationHandlers();
    const capture = captureEvents();

    await moderatorCaller().moderation.removeUser({ targetId: TARGET_ID });
    await settleCascade();

    expect(await meetupStatus(meetupId)).toBe("cancelled");
    expect(await conversationStatus(conversationId)).toBe("closed");

    const [blocked] = await db
      .select({ email: blockedEmail.email })
      .from(blockedEmail)
      .where(eq(blockedEmail.email, "target@example.com"));
    expect(blocked?.email).toBe("target@example.com");

    const cascades = capture.events.filter((e) => e.name === "ProposalsCancelledByCascade");
    expect(cascades).toHaveLength(1);
    expect(cascades[0]!.payload).toEqual({ targetId: TARGET_ID, peerIds: [PEER_ID] });
    capture.stop();
  });
});
