/**
 * Integration tests for soft-delete account behavior (#447/#446).
 *
 * Drives the real tRPC caller through the in-memory pg-mem harness to verify
 * that deleting an account:
 *   - retains the user row but scrubs PII and stamps `deletedAt`,
 *   - cancels in-progress meetups (never silently cascade-deletes them),
 *   - closes open conversations (history preserved),
 *   - removes the user from the matching pool,
 *   - revokes sessions / credentials / device tokens,
 *   - notifies the partner via ProposalsCancelledByCascade,
 *   - hides the deleted user from discover, and
 *   - blocks the partner from acting on the meetup afterwards.
 */
import "../../../__test-support__/harness";

import { describe, it, expect, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";

import { db } from "@sip-and-speak/db";
import { user, session, account } from "@sip-and-speak/db/schema/auth";
import { languageProfile, userLanguage, userInterest, userDeviceToken } from "@sip-and-speak/db/schema/identity";
import { venue, meetup } from "@sip-and-speak/db/schema/scheduling";
import { conversation } from "@sip-and-speak/db/schema/conversation";
import { matchRequest, studentMatch } from "@sip-and-speak/db/schema/matching";

import { appRouter } from "../../../routers";
import { resetDb, buildSessionContext, captureEvents } from "../../../__test-support__/harness";

const A = "del-A"; // the account being deleted
const B = "del-B"; // the partner

const FUTURE_AT = new Date("2099-09-01T18:00:00Z");

async function seedPairWithMeetup(): Promise<{ venueId: string; meetupId: string; conversationId: string }> {
  await db.insert(user).values([
    { id: A, name: "Alice", surname: "Anderson", email: "alice@example.com", image: "https://img/a.png", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    { id: B, name: "Bob", surname: "Baker", email: "bob@example.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
  ]);
  // Both are in the matching pool.
  await db.insert(languageProfile).values([
    { userId: A, onboardingComplete: true },
    { userId: B, onboardingComplete: true },
  ]);
  await db.insert(userLanguage).values([
    { userId: A, language: "en", type: "spoken" },
    { userId: A, language: "nl", type: "learning" },
    { userId: B, language: "nl", type: "spoken" },
    { userId: B, language: "en", type: "learning" },
  ]);
  await db.insert(userInterest).values([
    { userId: A, interest: "music" },
    { userId: B, interest: "music" },
  ]);
  await db.insert(session).values({
    id: "sess-A", token: "tok-A", userId: A,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60), createdAt: new Date(), updatedAt: new Date(),
  });
  await db.insert(account).values({
    id: "acct-A", accountId: "acct-A", providerId: "credential", userId: A,
    createdAt: new Date(), updatedAt: new Date(),
  });
  await db.insert(userDeviceToken).values({ userId: A, token: "device-A", platform: "ios" });

  const [v] = await db.insert(venue).values({ name: "Cafe Del", latitude: 51.4, longitude: 5.45, isActive: true }).returning();
  const [m] = await db.insert(meetup).values({
    proposerId: A, receiverId: B, venueId: v!.id, scheduledAt: FUTURE_AT, status: "confirmed",
  }).returning();
  const [c] = await db.insert(conversation).values({
    user1Id: A, user2Id: B, meetupId: m!.id, status: "open",
  }).returning();
  return { venueId: v!.id, meetupId: m!.id, conversationId: c!.id };
}

describe("account deletion — soft delete (#447/#446)", () => {
  beforeEach(() => {
    resetDb();
  });

  it("retains a scrubbed, soft-deleted user row instead of hard-deleting", async () => {
    await seedPairWithMeetup();
    const caller = appRouter.createCaller(buildSessionContext(A));

    await caller.profile.deleteAccount();

    const [row] = await db.select().from(user).where(eq(user.id, A));
    expect(row).toBeDefined();
    expect(row!.deletedAt).not.toBeNull();
    expect(row!.studentStatus).toBe("removed");
    expect(row!.name).toBe("Deleted user");
    expect(row!.surname).toBeNull();
    expect(row!.image).toBeNull();
    expect(row!.email).not.toBe("alice@example.com");
  });

  it("cancels in-progress meetups and notifies the partner", async () => {
    const { meetupId } = await seedPairWithMeetup();
    const capture = captureEvents();
    const caller = appRouter.createCaller(buildSessionContext(A));

    await caller.profile.deleteAccount();
    capture.stop();

    const [m] = await db.select().from(meetup).where(eq(meetup.id, meetupId));
    expect(m!.status).toBe("cancelled");

    const cascade = capture.events.filter((e) => e.name === "ProposalsCancelledByCascade");
    expect(cascade).toHaveLength(1);
    const payload = cascade[0]!.payload as { targetId: string; peerIds: string[] };
    expect(payload.targetId).toBe(A);
    expect(payload.peerIds).toEqual([B]);
  });

  it("closes open conversations and revokes auth + matching eligibility", async () => {
    const { conversationId } = await seedPairWithMeetup();
    const caller = appRouter.createCaller(buildSessionContext(A));

    await caller.profile.deleteAccount();

    const [c] = await db.select().from(conversation).where(eq(conversation.id, conversationId));
    expect(c!.status).toBe("closed");

    expect(await db.select().from(session).where(eq(session.userId, A))).toHaveLength(0);
    expect(await db.select().from(account).where(eq(account.userId, A))).toHaveLength(0);
    expect(await db.select().from(userDeviceToken).where(eq(userDeviceToken.userId, A))).toHaveLength(0);

    const [lp] = await db.select().from(languageProfile).where(eq(languageProfile.userId, A));
    expect(lp!.onboardingComplete).toBe(false);
  });

  it("excludes the deleted user from discover", async () => {
    await seedPairWithMeetup();
    // B discovers A before deletion.
    const before = await appRouter.createCaller(buildSessionContext(B)).matching.discover({});
    expect(before.partners.map((p) => p.userId)).toContain(A);

    await appRouter.createCaller(buildSessionContext(A)).profile.deleteAccount();

    const after = await appRouter.createCaller(buildSessionContext(B)).matching.discover({});
    expect(after.partners.map((p) => p.userId)).not.toContain(A);
  });

  it("blocks the partner from rescheduling/proposing against a deleted account", async () => {
    const { venueId, meetupId } = await seedPairWithMeetup();
    // Need a match so propose passes the match guard; deletion-guard must win first.
    const [req] = await db.insert(matchRequest).values({ requesterId: A, receiverId: B, status: "accepted" }).returning();
    await db.insert(studentMatch).values({ studentAId: A, studentBId: B, matchRequestId: req!.id, status: "matched" });

    await appRouter.createCaller(buildSessionContext(A)).profile.deleteAccount();

    const bCaller = appRouter.createCaller(buildSessionContext(B));
    const expectedMsg = "Sorry, this user has deleted their account in the middle of the process";

    await expect(
      bCaller.meetup.proposeReschedule({ meetupId, venueId, scheduledAt: FUTURE_AT.toISOString() }),
    ).rejects.toThrow(expectedMsg);

    await expect(
      bCaller.meetup.propose({ partnerId: A, venueId, scheduledAt: FUTURE_AT.toISOString() }),
    ).rejects.toThrow(expectedMsg);
  });
});
