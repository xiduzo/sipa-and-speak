/**
 * Tests for task #89 — Push notification on MeetupRescheduleProposed
 *
 * Drives the real `domainEvents` wiring via `registerNotificationHandlers`, with
 * the dispatch seam (InMemoryDelivery + InMemoryTokenStore) replacing DB,
 * drizzle, and fetch mocks.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { domainEvents } from "@sip-and-speak/api/domain-events";
import { InMemoryDelivery, setDelivery } from "../delivery";
import { InMemoryTokenStore, setTokenStore } from "../recipe";
import { registerNotificationHandlers } from "../dispatcher";

const delivery = new InMemoryDelivery();
const tokens = new InMemoryTokenStore();

const flush = () => new Promise((r) => setTimeout(r, 10));

describe("#89 — MeetupRescheduleProposed push notification", () => {
  beforeEach(() => {
    delivery.reset();
    tokens.reset();
    setDelivery(delivery);
    setTokenStore(tokens);
    domainEvents.removeAllListeners();
    registerNotificationHandlers();
  });

  afterEach(() => {
    domainEvents.removeAllListeners();
  });

  it("sends a push notification to the receiver when a reschedule is proposed", async () => {
    tokens.set("receiver-1", [{ id: "dt-1", token: "ExponentPushToken[abc]" }]);

    domainEvents.emit("MeetupRescheduleProposed", {
      meetupId: "m-1",
      proposerId: "proposer-1",
      receiverId: "receiver-1",
      venueId: "v-1",
      venueName: "Atlas Building",
      date: "2026-06-01",
      time: "14:00",
      proposedAt: new Date(),
    });

    await flush();

    expect(delivery.sent.length).toBe(1);
    const msg = delivery.sent[0]![0]!;
    expect(msg.title).toBe("Reschedule request");
    expect(msg.body).toContain("Atlas Building");
    expect(msg.data?.type).toBe("meetup_reschedule_proposed");
  });

  it("skips notification when receiver has no device token", async () => {
    domainEvents.emit("MeetupRescheduleProposed", {
      meetupId: "m-2",
      proposerId: "proposer-1",
      receiverId: "receiver-no-token",
      venueId: "v-1",
      venueName: "Atlas Building",
      date: "2026-06-01",
      time: "14:00",
      proposedAt: new Date(),
    });

    await flush();
    expect(delivery.sent.length).toBe(0);
  });
});
