/**
 * Tests for task #134 — Push notification on MatchRequestAccepted
 *
 * Covers:
 *   - Notification sent to requester when their match request is accepted
 *   - No notification sent when requester has no registered device token
 *
 * Uses the dispatch seam (InMemoryDelivery + InMemoryTokenStore) — no DB,
 * drizzle, or fetch mocking.
 */
import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryDelivery, setDelivery } from "../delivery";
import { InMemoryTokenStore, setTokenStore } from "../recipe";
import { handleMatchRequestAccepted } from "../dispatcher";

const delivery = new InMemoryDelivery();
const tokens = new InMemoryTokenStore();

function makeAcceptedEvent(
  overrides: Partial<{ requesterId: string; receiverId: string; matchRequestId: string; receiverName: string }> = {},
) {
  return {
    matchRequestId: overrides.matchRequestId ?? "req-123",
    requesterId: overrides.requesterId ?? "requester-id",
    receiverId: overrides.receiverId ?? "receiver-id",
    receiverName: overrides.receiverName ?? "Alice",
    acceptedAt: new Date(),
  };
}

beforeEach(() => {
  delivery.reset();
  tokens.reset();
  setDelivery(delivery);
  setTokenStore(tokens);
});

describe("#134 — Push notification on MatchRequestAccepted", () => {
  it("sends a push notification to the requester when their request is accepted", async () => {
    tokens.set("requester-id", [{ id: "tok-1", token: "ExponentPushToken[abc]" }]);

    await handleMatchRequestAccepted(makeAcceptedEvent());

    expect(delivery.sent).toHaveLength(1);

    const messages = delivery.sent[0];
    if (!messages) throw new Error("Expected a delivery batch");
    expect(messages).toHaveLength(1);

    const msg = messages[0];
    if (!msg) throw new Error("Expected a message");

    expect(msg.to).toBe("ExponentPushToken[abc]");
    expect(msg.title).toBe("Your match request was accepted!");
    expect(msg.data?.type).toBe("match_accepted");
    expect(msg.data?.matchRequestId).toBe("req-123");
  });

  it("does not send a push notification when the requester has no registered device token", async () => {
    await handleMatchRequestAccepted(makeAcceptedEvent());

    expect(delivery.sent).toHaveLength(0);
  });
});
