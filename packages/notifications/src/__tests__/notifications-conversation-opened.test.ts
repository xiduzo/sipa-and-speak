/**
 * Tests for task #141 — Open conversation channel and notify both Students when both accept
 *
 * Covers:
 *   - Both Students receive a "messaging is now open" push notification
 *   - No notification sent when neither Student has a device token
 *
 * Uses the dispatch seam (InMemoryDelivery + InMemoryTokenStore) — no DB,
 * drizzle, or fetch mocking.
 */
import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryDelivery, setDelivery } from "../delivery";
import { InMemoryTokenStore, setTokenStore } from "../recipe";
import { handleConversationOpened } from "../dispatcher";

const STUDENT_A_ID = "student-a-id";
const STUDENT_B_ID = "student-b-id";

const delivery = new InMemoryDelivery();
const tokens = new InMemoryTokenStore();

function makeConversationOpenedEvent(
  overrides: Partial<{
    conversationId: string;
    meetupId: string;
    studentAId: string;
    studentAName: string;
    studentBId: string;
    studentBName: string;
  }> = {},
) {
  return {
    conversationId: overrides.conversationId ?? "conv-1",
    meetupId: overrides.meetupId ?? "meetup-1",
    studentAId: overrides.studentAId ?? STUDENT_A_ID,
    studentAName: overrides.studentAName ?? "Alice",
    studentBId: overrides.studentBId ?? STUDENT_B_ID,
    studentBName: overrides.studentBName ?? "Bob",
    openedAt: new Date(),
  };
}

beforeEach(() => {
  delivery.reset();
  tokens.reset();
  setDelivery(delivery);
  setTokenStore(tokens);
});

describe("#141 — Notify both Students when conversation channel opens", () => {
  it("sends a push to both Students with partner name and conversation deep link", async () => {
    tokens.set(STUDENT_A_ID, [{ id: "tok-a", token: "ExponentPushToken[alice]" }]);
    tokens.set(STUDENT_B_ID, [{ id: "tok-b", token: "ExponentPushToken[bob]" }]);

    await handleConversationOpened(makeConversationOpenedEvent());

    expect(delivery.sent).toHaveLength(1);

    const messages = delivery.sent[0];
    if (!messages) throw new Error("Expected a delivery batch");
    expect(messages).toHaveLength(2);

    const aliceMsg = messages.find((m) => m.to === "ExponentPushToken[alice]");
    const bobMsg = messages.find((m) => m.to === "ExponentPushToken[bob]");

    expect(aliceMsg?.title).toBe("Your messaging channel is open!");
    expect(aliceMsg?.body).toContain("Bob");
    expect(aliceMsg?.data?.type).toBe("conversation_opened");
    expect(aliceMsg?.data?.conversationId).toBe("conv-1");
    expect(aliceMsg?.data?.deepLink).toBe("/conversations/conv-1");

    expect(bobMsg?.title).toBe("Your messaging channel is open!");
    expect(bobMsg?.body).toContain("Alice");
    expect(bobMsg?.data?.conversationId).toBe("conv-1");
  });

  it("sends no notification when neither Student has a registered device token", async () => {
    await handleConversationOpened(makeConversationOpenedEvent());

    expect(delivery.sent).toHaveLength(0);
  });
});
