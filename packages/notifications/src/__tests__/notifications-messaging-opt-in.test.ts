/**
 * Tests for task #138 — Send opt-in push notification to both Students after meetup is completed
 *
 * Covers:
 *   - Both Students receive an opt-in prompt when their meetup is completed
 *   - No notification sent when neither Student has a device token
 *
 * Uses the dispatch seam (InMemoryDelivery + InMemoryTokenStore) — no DB,
 * drizzle, or fetch mocking.
 */
import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryDelivery, setDelivery } from "../delivery";
import { InMemoryTokenStore, setTokenStore } from "../recipe";
import { handleMessagingOptInPrompted } from "../dispatcher";

const STUDENT_A_ID = "student-a-id";
const STUDENT_B_ID = "student-b-id";

const delivery = new InMemoryDelivery();
const tokens = new InMemoryTokenStore();

function makeOptInEvent(
  overrides: Partial<{ meetupId: string; studentAId: string; studentAName: string; studentBId: string; studentBName: string }> = {},
) {
  return {
    meetupId: overrides.meetupId ?? "meetup-1",
    studentAId: overrides.studentAId ?? STUDENT_A_ID,
    studentAName: overrides.studentAName ?? "Alice",
    studentBId: overrides.studentBId ?? STUDENT_B_ID,
    studentBName: overrides.studentBName ?? "Bob",
    promptedAt: new Date(),
  };
}

beforeEach(() => {
  delivery.reset();
  tokens.reset();
  setDelivery(delivery);
  setTokenStore(tokens);
});

describe("#138 — Send opt-in push notification to both Students after meetup is completed", () => {
  it("sends an opt-in push to both Students when their meetup is completed", async () => {
    tokens.set(STUDENT_A_ID, [{ id: "tok-a", token: "ExponentPushToken[alice]" }]);
    tokens.set(STUDENT_B_ID, [{ id: "tok-b", token: "ExponentPushToken[bob]" }]);

    await handleMessagingOptInPrompted(makeOptInEvent());

    expect(delivery.sent).toHaveLength(1);

    const messages = delivery.sent[0];
    if (!messages) throw new Error("Expected a delivery batch");
    expect(messages).toHaveLength(2);

    const tokenList = messages.map((m) => m.to);
    expect(tokenList).toContain("ExponentPushToken[alice]");
    expect(tokenList).toContain("ExponentPushToken[bob]");

    // Student A (Alice) sees Bob's name
    const aliceMsg = messages.find((m) => m.to === "ExponentPushToken[alice]");
    expect(aliceMsg?.title).toBe("Want to keep in touch?");
    expect(aliceMsg?.body).toContain("Bob");
    expect(aliceMsg?.data?.type).toBe("messaging_opt_in");
    expect(aliceMsg?.data?.meetupId).toBe("meetup-1");

    // Student B (Bob) sees Alice's name
    const bobMsg = messages.find((m) => m.to === "ExponentPushToken[bob]");
    expect(bobMsg?.title).toBe("Want to keep in touch?");
    expect(bobMsg?.body).toContain("Alice");
    expect(bobMsg?.data?.type).toBe("messaging_opt_in");
    expect(bobMsg?.data?.meetupId).toBe("meetup-1");
  });

  it("sends no notification when neither Student has a registered device token", async () => {
    await handleMessagingOptInPrompted(makeOptInEvent());

    expect(delivery.sent).toHaveLength(0);
  });
});
