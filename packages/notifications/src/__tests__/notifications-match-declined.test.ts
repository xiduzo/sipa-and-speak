/**
 * Tests for task #135 — Push notification on MatchRequestDeclined
 *
 * Covers:
 *   - Notification sent to requester when their match request is declined
 *   - Notification body does not identify the declining receiver
 *   - No notification sent when requester has no registered device token
 *
 * Uses the dispatch seam (InMemoryDelivery + InMemoryTokenStore) — no DB,
 * drizzle, or fetch mocking.
 */
import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryDelivery, setDelivery } from "../delivery";
import { InMemoryTokenStore, setTokenStore } from "../recipe";
import { handleMatchRequestDeclined } from "../dispatcher";

const delivery = new InMemoryDelivery();
const tokens = new InMemoryTokenStore();

function makeDeclinedEvent(
  overrides: Partial<{ requesterId: string; receiverId: string; matchRequestId: string }> = {},
) {
  return {
    matchRequestId: overrides.matchRequestId ?? "req-456",
    requesterId: overrides.requesterId ?? "requester-id",
    receiverId: overrides.receiverId ?? "receiver-id",
    declinedAt: new Date(),
  };
}

beforeEach(() => {
  delivery.reset();
  tokens.reset();
  setDelivery(delivery);
  setTokenStore(tokens);
});

describe("#135 — Push notification on MatchRequestDeclined", () => {
  it("sends a push notification to the requester when their request is declined", async () => {
    tokens.set("requester-id", [{ id: "tok-2", token: "ExponentPushToken[def]" }]);

    await handleMatchRequestDeclined(makeDeclinedEvent());

    expect(delivery.sent).toHaveLength(1);

    const messages = delivery.sent[0];
    if (!messages) throw new Error("Expected a delivery batch");
    expect(messages).toHaveLength(1);

    const msg = messages[0];
    if (!msg) throw new Error("Expected a message");

    expect(msg.to).toBe("ExponentPushToken[def]");
    expect(msg.title).toBe("Your match request was not accepted");
    expect(msg.data?.type).toBe("match_declined");
    expect(msg.data?.matchRequestId).toBe("req-456");
  });

  it("does not include the receiver's name in the notification body", async () => {
    tokens.set("requester-id", [{ id: "tok-2", token: "ExponentPushToken[def]" }]);

    await handleMatchRequestDeclined(makeDeclinedEvent({ receiverId: "receiver-xyz" }));

    const msg = delivery.sent[0]?.[0];
    if (!msg) throw new Error("Expected a message");

    // Body must not reference the receiver identity — privacy invariant
    expect(msg.body).not.toContain("receiver-xyz");
    expect(msg.body).toBeTruthy();
  });

  it("does not send a push notification when the requester has no registered device token", async () => {
    await handleMatchRequestDeclined(makeDeclinedEvent());

    expect(delivery.sent).toHaveLength(0);
  });
});
