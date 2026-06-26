/**
 * Tests for task #152 — Send push notification to recipient when a new message arrives
 * Tests for task #156 — Handle gracefully when recipient has not granted push permissions
 * Tests for task #154 — Include match identity in notification payload without message content
 *
 * Covers:
 *   - Recipient receives a push identifying the sender (no message content)
 *   - No push sent when recipient has no registered device token
 *   - DeviceNotRegistered receipt error is handled gracefully (stale token removed)
 *   - Notification payload shape: title = sender name, body = generic, conversationId in data
 *
 * Uses the dispatch seam (InMemoryDelivery + InMemoryTokenStore) — no DB,
 * drizzle, or fetch mocking. Per-token Expo errors are simulated with
 * `InMemoryDelivery.setNextTickets`; pruned tokens are read from
 * `InMemoryTokenStore.removed`.
 */
import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryDelivery, setDelivery } from "../delivery";
import { InMemoryTokenStore, setTokenStore } from "../recipe";
import { handleMessageSent } from "../dispatcher";

const SENDER_ID = "sender-id";
const RECIPIENT_ID = "recipient-id";

const delivery = new InMemoryDelivery();
const tokens = new InMemoryTokenStore();

function makeMessageSentEvent(
  overrides: Partial<{
    conversationId: string;
    senderId: string;
    recipientId: string;
    senderName: string;
    recipientIsPresent: boolean;
  }> = {},
) {
  return {
    conversationId: overrides.conversationId ?? "conv-1",
    senderId: overrides.senderId ?? SENDER_ID,
    recipientId: overrides.recipientId ?? RECIPIENT_ID,
    senderName: overrides.senderName ?? "Alice",
    recipientIsPresent: overrides.recipientIsPresent ?? false,
  };
}

beforeEach(() => {
  delivery.reset();
  tokens.reset();
  setDelivery(delivery);
  setTokenStore(tokens);
});

describe("#152 — Send push notification to recipient when a new message arrives", () => {
  it("sends a push to the recipient identifying the sender without message content", async () => {
    tokens.set(RECIPIENT_ID, [{ id: "tok-1", token: "ExponentPushToken[recipient]" }]);

    await handleMessageSent(makeMessageSentEvent());

    expect(delivery.sent).toHaveLength(1);

    const messages = delivery.sent[0];
    if (!messages) throw new Error("Expected a delivery batch");
    expect(messages).toHaveLength(1);

    const msg = messages[0];
    if (!msg) throw new Error("Expected a message");

    expect(msg.to).toBe("ExponentPushToken[recipient]");
    // #154 — title is sender's display name; body is generic (no message content)
    expect(msg.title).toBe("Alice");
    expect(msg.body).toBe("sent you a message");
    expect(msg.data?.type).toBe("message_received");
    expect(msg.data?.conversationId).toBe("conv-1");
    expect(msg.data?.senderId).toBe(SENDER_ID);
  });

  it("sends no notification when recipient has no registered device token", async () => {
    await handleMessageSent(makeMessageSentEvent());

    expect(delivery.sent).toHaveLength(0);
  });
});

describe("#154 — Notification payload includes sender identity but not message content", () => {
  it("sets title to sender display name and body to a generic string", async () => {
    tokens.set(RECIPIENT_ID, [{ id: "tok-1", token: "ExponentPushToken[recipient]" }]);

    await handleMessageSent(makeMessageSentEvent({ senderName: "Bob" }));

    const msg = delivery.sent[0]?.[0];
    if (!msg) throw new Error("Expected a message");

    expect(msg.title).toBe("Bob");
    expect(msg.body).toBe("sent you a message");
  });

  it("payload contains conversationId for deep-linking", async () => {
    tokens.set(RECIPIENT_ID, [{ id: "tok-1", token: "ExponentPushToken[recipient]" }]);

    await handleMessageSent(makeMessageSentEvent({ conversationId: "conv-deep-link" }));

    const msg = delivery.sent[0]?.[0];
    if (!msg) throw new Error("Expected a message");

    expect(msg.data?.conversationId).toBe("conv-deep-link");
  });
});

describe("#156 — Handle gracefully when recipient has not granted push permissions", () => {
  it("removes stale token and does not throw when Expo returns DeviceNotRegistered", async () => {
    tokens.set(RECIPIENT_ID, [{ id: "stale-tok-id", token: "ExponentPushToken[stale]" }]);
    delivery.setNextTickets([{ status: "error", details: { error: "DeviceNotRegistered" } }]);

    await expect(handleMessageSent(makeMessageSentEvent())).resolves.toBeUndefined();

    expect(tokens.removed).toContain("stale-tok-id");
  });

  it("still resolves when the recipient has no tokens left", async () => {
    // Token already pruned on a prior send — no tokens left, so no push attempt.
    await expect(handleMessageSent(makeMessageSentEvent())).resolves.toBeUndefined();
    expect(delivery.sent).toHaveLength(0);
  });
});
