/**
 * Tests for task #75 — Push notification on MeetupConfirmed
 *
 * Covers:
 *   - Both Students notified when a meetup is confirmed
 *   - No notification sent when neither Student has a device token
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

const PROPOSER_ID = "proposer-123";
const RECEIVER_ID = "receiver-456";

const delivery = new InMemoryDelivery();
const tokens = new InMemoryTokenStore();

const flush = () => new Promise((r) => setTimeout(r, 10));

describe("handleMeetupConfirmed", () => {
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

  it("notifies both Students when a meetup is confirmed", async () => {
    tokens.set(PROPOSER_ID, [{ id: "pt-1", token: "ExponentPushToken[proposer-token]" }]);
    tokens.set(RECEIVER_ID, [{ id: "rt-1", token: "ExponentPushToken[receiver-token]" }]);

    domainEvents.emit("MeetupConfirmed", {
      meetupId: "meetup-1",
      proposerId: PROPOSER_ID,
      receiverId: RECEIVER_ID,
      venueName: "Atlas Building",
      date: "2026-05-10",
      time: "14:00",
      confirmedAt: new Date(),
    });

    await flush();

    expect(delivery.sent.length).toBe(1);
    const sentMessages = delivery.sent[0]!;
    expect(sentMessages.length).toBe(2);
    expect(sentMessages.map((m) => m.to)).toContain("ExponentPushToken[proposer-token]");
    expect(sentMessages.map((m) => m.to)).toContain("ExponentPushToken[receiver-token]");
    expect(sentMessages[0]!.title).toBe("Meetup confirmed! 🎉");
    expect(sentMessages[0]!.body).toContain("Atlas Building");
  });

  it("sends no notification when neither Student has a device token", async () => {
    domainEvents.emit("MeetupConfirmed", {
      meetupId: "meetup-2",
      proposerId: PROPOSER_ID,
      receiverId: RECEIVER_ID,
      venueName: "Flux",
      date: "2026-05-11",
      time: "10:00",
      confirmedAt: new Date(),
    });

    await flush();

    expect(delivery.sent.length).toBe(0);
  });
});
