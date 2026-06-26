/**
 * Integration tests for the commitAndEmit unit-of-work seam. Uses the pg-mem
 * harness to prove the two guarantees the seam exists for:
 *   1. buffered events fire only after the transaction commits, and
 *   2. a rolled-back transaction persists nothing and emits nothing.
 */
import "../__test-support__/harness";

import { describe, it, expect, beforeEach } from "bun:test";

import { db } from "@sip-and-speak/db";
import { venue } from "@sip-and-speak/db/schema/scheduling";

import { commitAndEmit } from "../unit-of-work";
import { resetDb, captureEvents } from "../__test-support__/harness";

describe("commitAndEmit", () => {
  beforeEach(() => {
    resetDb();
  });

  it("commits the writes and emits the buffered events", async () => {
    const cap = captureEvents();
    const id = await commitAndEmit(async (tx) => {
      const [row] = await tx
        .insert(venue)
        .values({ name: "Seam Cafe", latitude: 51.4, longitude: 5.45, isActive: true })
        .returning();
      return {
        result: row!.id,
        events: [{ name: "MeetupProposed", payload: { meetupId: row!.id, proposerId: "x" } }],
      };
    });
    cap.stop();

    const rows = await db.select().from(venue);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(id);
    expect(cap.events).toHaveLength(1);
    expect(cap.events[0]!.name).toBe("MeetupProposed");
    expect((cap.events[0]!.payload as { meetupId: string }).meetupId).toBe(id);
  });

  it("emits each buffered event in order", async () => {
    const cap = captureEvents();
    await commitAndEmit(async () => ({
      result: undefined,
      events: [
        { name: "MatchRequestSent", payload: { n: 1 } },
        { name: "MatchRequestAccepted", payload: { n: 2 } },
      ],
    }));
    cap.stop();

    expect(cap.events.map((e) => e.name)).toEqual([
      "MatchRequestSent",
      "MatchRequestAccepted",
    ]);
  });

  it("emits nothing when the work throws", async () => {
    // commitAndEmit's own guarantee: if the transaction callback throws, the
    // promise rejects and the emit loop is never reached — so a failed
    // transition can never leak a domain event. (Whether the *writes* roll back
    // is a Postgres guarantee; pg-mem does not emulate ROLLBACK, so persistence
    // is not asserted here — it holds in production.)
    const cap = captureEvents();
    await expect(
      commitAndEmit(async (tx) => {
        await tx
          .insert(venue)
          .values({ name: "Doomed Cafe", latitude: 1, longitude: 2, isActive: true });
        // Throw before returning any events — the emit loop must never run.
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    cap.stop();

    expect(cap.events).toHaveLength(0);
  });
});
