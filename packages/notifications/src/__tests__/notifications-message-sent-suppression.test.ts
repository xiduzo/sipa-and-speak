/**
 * Tests for task #153 — Suppress push notification when recipient is actively viewing
 *
 * The presence check runs in the conversation context before MessageSent is emitted.
 * The dispatcher reads event.recipientIsPresent and suppresses the push if true.
 *
 * Covers:
 *   - No push sent when recipientIsPresent is true
 *   - Push sent when recipientIsPresent is false
 *
 * Uses the dispatch seam (InMemoryDelivery + InMemoryTokenStore) — no DB,
 * drizzle, or fetch mocking.
 */
import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryDelivery, setDelivery } from "../delivery";
import { InMemoryTokenStore, setTokenStore } from "../recipe";
import { handleMessageSent } from "../dispatcher";

const RECIPIENT_ID = "recipient-id";
const SENDER_ID = "sender-id";
const CONVERSATION_ID = "conv-1";

const delivery = new InMemoryDelivery();
const tokens = new InMemoryTokenStore();

function makeEvent(recipientIsPresent = false) {
  return {
    conversationId: CONVERSATION_ID,
    senderId: SENDER_ID,
    recipientId: RECIPIENT_ID,
    senderName: "Alice",
    recipientIsPresent,
  };
}

beforeEach(() => {
  delivery.reset();
  tokens.reset();
  setDelivery(delivery);
  setTokenStore(tokens);
  // Recipient always has a registered device — suppression must be the only reason no push is sent.
  tokens.set(RECIPIENT_ID, [{ id: "tok-1", token: "ExponentPushToken[recipient]" }]);
});

describe("#153 — Suppress push when recipient is actively viewing", () => {
  it("suppresses push when recipientIsPresent is true", async () => {
    await handleMessageSent(makeEvent(true));

    expect(delivery.sent).toHaveLength(0);
  });

  it("sends push when recipientIsPresent is false", async () => {
    await handleMessageSent(makeEvent(false));

    expect(delivery.sent).toHaveLength(1);
  });
});
