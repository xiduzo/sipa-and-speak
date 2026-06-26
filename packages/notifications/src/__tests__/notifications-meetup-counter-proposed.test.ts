/**
 * Tests for task #76 — Push notification on MeetupCounterProposed
 *
 * Covers:
 *   - Original proposer (now the new receiver) notified when a counter-proposal arrives
 *   - No notification sent when the new receiver has no device token
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

const ORIGINAL_PROPOSER_ID = "orig-proposer-123"; // becomes newReceiverId after counter

const delivery = new InMemoryDelivery();
const tokens = new InMemoryTokenStore();

const flush = () => new Promise((r) => setTimeout(r, 10));

describe("handleMeetupCounterProposed", () => {
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

  it("notifies the original proposer (new receiver) of the counter-proposal", async () => {
    tokens.set(ORIGINAL_PROPOSER_ID, [{ id: "token-1", token: "ExponentPushToken[orig-proposer]" }]);

    domainEvents.emit("MeetupCounterProposed", {
      meetupId: "meetup-1",
      newProposerId: "counter-proposer-456",
      newReceiverId: ORIGINAL_PROPOSER_ID,
      venueName: "Vertigo",
      date: "2026-05-15",
      time: "10:30",
      round: 2,
      counterProposedAt: new Date(),
    });

    await flush();

    expect(delivery.sent.length).toBe(1);
    const msg = delivery.sent[0]![0]!;
    expect(msg.to).toBe("ExponentPushToken[orig-proposer]");
    expect(msg.title).toContain("round 2");
    expect(msg.body).toContain("Vertigo");
  });

  it("sends no notification when new receiver has no device token", async () => {
    domainEvents.emit("MeetupCounterProposed", {
      meetupId: "meetup-2",
      newProposerId: "counter-proposer-456",
      newReceiverId: ORIGINAL_PROPOSER_ID,
      venueName: "Atlas",
      date: "2026-05-16",
      time: "11:00",
      round: 2,
      counterProposedAt: new Date(),
    });

    await flush();

    expect(delivery.sent.length).toBe(0);
  });
});
