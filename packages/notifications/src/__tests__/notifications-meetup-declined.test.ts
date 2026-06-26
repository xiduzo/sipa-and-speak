/**
 * Tests for task #77 — Push notification on MeetupDeclined
 *
 * Covers:
 *   - Both Students notified when a proposal is declined
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

const PROPOSER_ID = "proposer-abc";
const RECEIVER_ID = "receiver-xyz";

const delivery = new InMemoryDelivery();
const tokens = new InMemoryTokenStore();

const flush = () => new Promise((r) => setTimeout(r, 10));

describe("handleMeetupDeclined", () => {
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

  it("notifies both Students when a proposal is declined", async () => {
    tokens.set(PROPOSER_ID, [{ id: "pt-1", token: "ExponentPushToken[proposer-token]" }]);
    tokens.set(RECEIVER_ID, [{ id: "rt-1", token: "ExponentPushToken[receiver-token]" }]);

    domainEvents.emit("MeetupDeclined", {
      meetupId: "meetup-1",
      proposerId: PROPOSER_ID,
      receiverId: RECEIVER_ID,
      declinedAt: new Date(),
    });

    await flush();

    expect(delivery.sent.length).toBe(1);
    const msgs = delivery.sent[0]!;
    expect(msgs.length).toBe(2);
    expect(msgs.map((m) => m.to)).toContain("ExponentPushToken[proposer-token]");
    expect(msgs.map((m) => m.to)).toContain("ExponentPushToken[receiver-token]");
    expect(msgs[0]!.title).toBe("Meetup proposal declined");
  });

  it("sends no notification when neither Student has a device token", async () => {
    domainEvents.emit("MeetupDeclined", {
      meetupId: "meetup-2",
      proposerId: PROPOSER_ID,
      receiverId: RECEIVER_ID,
      declinedAt: new Date(),
    });

    await flush();

    expect(delivery.sent.length).toBe(0);
  });
});
