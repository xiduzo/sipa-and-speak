/**
 * Tests for #347 — Push notification on MatchRequestSent
 *
 * Covers:
 *   - Notification sent to receiver when a match request is sent to them
 *   - No notification sent when receiver has no registered device token
 *
 * Uses the dispatch seam (InMemoryDelivery + InMemoryTokenStore) — no DB,
 * drizzle, or fetch mocking.
 */
import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryDelivery, setDelivery } from "../delivery";
import { InMemoryTokenStore, setTokenStore } from "../recipe";
import { handleMatchRequestSent } from "../dispatcher";

const delivery = new InMemoryDelivery();
const tokens = new InMemoryTokenStore();

function makeSentEvent(
  overrides: Partial<{
    matchRequestId: string;
    requesterId: string;
    requesterName: string;
    receiverId: string;
    offeredLanguage: string | null;
    targetedLanguage: string | null;
  }> = {},
) {
  return {
    matchRequestId: overrides.matchRequestId ?? "req-456",
    requesterId: overrides.requesterId ?? "requester-id",
    requesterName: overrides.requesterName ?? "Alice",
    receiverId: overrides.receiverId ?? "receiver-id",
    offeredLanguage: overrides.offeredLanguage ?? "English",
    targetedLanguage: overrides.targetedLanguage ?? "Dutch",
    sentAt: new Date(),
  };
}

beforeEach(() => {
  delivery.reset();
  tokens.reset();
  setDelivery(delivery);
  setTokenStore(tokens);
});

describe("#347 — Push notification on MatchRequestSent", () => {
  it("sends a push notification to the receiver when a match request is sent", async () => {
    tokens.set("receiver-id", [{ id: "tok-1", token: "ExponentPushToken[xyz]" }]);

    await handleMatchRequestSent(makeSentEvent());

    expect(delivery.sent).toHaveLength(1);

    const messages = delivery.sent[0];
    if (!messages) throw new Error("Expected a delivery batch");
    expect(messages).toHaveLength(1);

    const msg = messages[0];
    if (!msg) throw new Error("Expected a message");

    expect(msg.to).toBe("ExponentPushToken[xyz]");
    expect(msg.title).toBe("New match request");
    expect(msg.data?.matchRequestId).toBe("req-456");
    expect(msg.data?.requesterId).toBe("requester-id");
  });

  it("does not send a push notification when the receiver has no registered device token", async () => {
    await handleMatchRequestSent(makeSentEvent());

    expect(delivery.sent).toHaveLength(0);
  });
});
