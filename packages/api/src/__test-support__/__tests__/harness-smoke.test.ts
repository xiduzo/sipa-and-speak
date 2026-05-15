/**
 * Smoke test for the integration test harness. If pg-mem cannot apply the
 * production migrations, this fails first — keeping the diagnostic on the
 * infrastructure rather than on the aggregate tests.
 */
import "../harness";
import { describe, it, expect, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";

import { db } from "@sip-and-speak/db";
import { user } from "@sip-and-speak/db/schema/auth";
import { resetDb, captureEvents } from "../harness";
import { domainEvents } from "../../domain-events";

describe("harness smoke", () => {
  beforeEach(() => {
    resetDb();
  });

  it("boots pg-mem with migrations applied (user table exists)", async () => {
    await db.insert(user).values({
      id: "u-smoke-1",
      name: "Smoke One",
      email: "smoke1@example.com",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const found = await db.select().from(user).where(eq(user.id, "u-smoke-1"));
    expect(found).toHaveLength(1);
    expect(found[0]!.email).toBe("smoke1@example.com");
  });

  it("resetDb wipes state between tests", async () => {
    const found = await db.select().from(user);
    expect(found).toHaveLength(0);
  });

  it("captureEvents records emitted domain events", () => {
    const capture = captureEvents();
    domainEvents.emit("MeetupProposed", {
      meetupId: "m-1",
      proposerId: "u-1",
      receiverId: "u-2",
      venueName: "Test Cafe",
      date: "2030-01-01",
      time: "12:00",
      proposedAt: new Date(),
    });
    capture.stop();
    expect(capture.events).toHaveLength(1);
    expect(capture.events[0]!.name).toBe("MeetupProposed");
  });
});
