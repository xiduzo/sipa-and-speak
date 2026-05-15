/**
 * Integration tests for the Meetup router. Uses the in-memory pg-mem harness
 * to drive the real tRPC caller end-to-end: input → router → aggregate → DB →
 * emitted domain events.
 */
import "../../../__test-support__/harness";

import { describe, it, expect, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";

import { db } from "@sip-and-speak/db";
import { user } from "@sip-and-speak/db/schema/auth";
import { venue, meetup } from "@sip-and-speak/db/schema/scheduling";
import { matchRequest, studentMatch } from "@sip-and-speak/db/schema/matching";

import { appRouter } from "../../../routers";
import { resetDb, buildSessionContext, captureEvents } from "../../../__test-support__/harness";

const FUTURE_DATE = "2099-09-01";
const FUTURE_TIME = "18:00";

async function seedMatchedPair(): Promise<{ a: string; b: string; venueId: string }> {
  const a = "u-A";
  const b = "u-B";
  await db.insert(user).values([
    { id: a, name: "A", email: "a@example.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    { id: b, name: "B", email: "b@example.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
  ]);
  const [req] = await db
    .insert(matchRequest)
    .values({ requesterId: a, receiverId: b, status: "accepted" })
    .returning();
  await db.insert(studentMatch).values({
    studentAId: a,
    studentBId: b,
    matchRequestId: req!.id,
    status: "matched",
  });
  const [v] = await db
    .insert(venue)
    .values({
      name: "Cafe Test",
      latitude: 51.4,
      longitude: 5.45,
      isActive: true,
    })
    .returning();
  return { a, b, venueId: v!.id };
}

describe("meetup integration — propose", () => {
  beforeEach(() => {
    resetDb();
  });

  it("happy path: persists pending row, returns it, emits MeetupProposed", async () => {
    const { a, b, venueId } = await seedMatchedPair();
    const capture = captureEvents();

    const caller = appRouter.createCaller(buildSessionContext(a));
    const created = await caller.meetup.propose({
      partnerId: b,
      venueId,
      date: FUTURE_DATE,
      time: FUTURE_TIME,
    });

    capture.stop();

    expect(created.status).toBe("pending");
    expect(created.proposerId).toBe(a);
    expect(created.receiverId).toBe(b);
    expect(created.round).toBe(1);

    const rows = await db.select().from(meetup).where(eq(meetup.id, created.id));
    expect(rows).toHaveLength(1);

    const proposed = capture.events.filter((e) => e.name === "MeetupProposed");
    expect(proposed).toHaveLength(1);
    const payload = proposed[0]!.payload as { meetupId: string; proposerId: string };
    expect(payload.meetupId).toBe(created.id);
    expect(payload.proposerId).toBe(a);
  });

  it("rejects self-proposal at the tRPC boundary", async () => {
    const { a } = await seedMatchedPair();
    const caller = appRouter.createCaller(buildSessionContext(a));
    await expect(
      caller.meetup.propose({
        partnerId: a,
        venueId: "any",
        date: FUTURE_DATE,
        time: FUTURE_TIME,
      }),
    ).rejects.toThrow(/yourself/);
  });

  it("rejects propose when no match record exists", async () => {
    await db.insert(user).values([
      { id: "u-X", name: "X", email: "x@example.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
      { id: "u-Y", name: "Y", email: "y@example.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    ]);
    const [v] = await db
      .insert(venue)
      .values({ name: "Cafe X", latitude: 51, longitude: 5, isActive: true })
      .returning();
    const caller = appRouter.createCaller(buildSessionContext("u-X"));
    await expect(
      caller.meetup.propose({
        partnerId: "u-Y",
        venueId: v!.id,
        date: FUTURE_DATE,
        time: FUTURE_TIME,
      }),
    ).rejects.toThrow(/matched partner/);
  });
});

describe("meetup integration — accept/decline lifecycle", () => {
  beforeEach(() => {
    resetDb();
  });

  it("acceptProposal transitions pending → confirmed and emits MeetupConfirmed", async () => {
    const { a, b, venueId } = await seedMatchedPair();
    const proposeCaller = appRouter.createCaller(buildSessionContext(a));
    const created = await proposeCaller.meetup.propose({
      partnerId: b,
      venueId,
      date: FUTURE_DATE,
      time: FUTURE_TIME,
    });

    const capture = captureEvents();
    const receiverCaller = appRouter.createCaller(buildSessionContext(b));
    const updated = await receiverCaller.meetup.acceptProposal({ meetupId: created.id });
    capture.stop();

    expect(updated!.status).toBe("confirmed");
    expect(capture.events.map((e) => e.name)).toContain("MeetupConfirmed");
  });

  it("declineProposal transitions pending → declined and emits MeetupDeclined", async () => {
    const { a, b, venueId } = await seedMatchedPair();
    const created = await appRouter
      .createCaller(buildSessionContext(a))
      .meetup.propose({ partnerId: b, venueId, date: FUTURE_DATE, time: FUTURE_TIME });

    const capture = captureEvents();
    const updated = await appRouter
      .createCaller(buildSessionContext(b))
      .meetup.declineProposal({ meetupId: created.id });
    capture.stop();

    expect(updated!.status).toBe("declined");
    expect(capture.events.map((e) => e.name)).toContain("MeetupDeclined");
  });

  it("rejects the proposer from accepting their own proposal", async () => {
    const { a, b, venueId } = await seedMatchedPair();
    const created = await appRouter
      .createCaller(buildSessionContext(a))
      .meetup.propose({ partnerId: b, venueId, date: FUTURE_DATE, time: FUTURE_TIME });

    await expect(
      appRouter
        .createCaller(buildSessionContext(a))
        .meetup.acceptProposal({ meetupId: created.id }),
    ).rejects.toThrow(/responder/);
  });
});

describe("meetup integration — counter-propose", () => {
  beforeEach(() => {
    resetDb();
  });

  it("counterPropose swaps roles, increments round, persists new details", async () => {
    const { a, b, venueId } = await seedMatchedPair();
    const created = await appRouter
      .createCaller(buildSessionContext(a))
      .meetup.propose({ partnerId: b, venueId, date: FUTURE_DATE, time: FUTURE_TIME });

    // Second venue for the counter
    const [v2] = await db
      .insert(venue)
      .values({ name: "Cafe Two", latitude: 51, longitude: 5, isActive: true })
      .returning();

    const capture = captureEvents();
    const counter = await appRouter
      .createCaller(buildSessionContext(b))
      .meetup.counterPropose({
        meetupId: created.id,
        venueId: v2!.id,
        date: FUTURE_DATE,
        time: "19:30",
      });
    capture.stop();

    expect(counter!.proposerId).toBe(b);
    expect(counter!.receiverId).toBe(a);
    expect(counter!.round).toBe(2);
    expect(counter!.venueId).toBe(v2!.id);
    expect(counter!.time).toBe("19:30");
    expect(capture.events.map((e) => e.name)).toContain("MeetupCounterProposed");
  });
});
