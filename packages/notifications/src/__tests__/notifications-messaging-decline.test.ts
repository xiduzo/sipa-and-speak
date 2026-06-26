/**
 * Tests for task #142 — Notify both Students when messaging channel won't open (decline outcome)
 *
 * Uses the dispatch seam (InMemoryDelivery + InMemoryTokenStore) — no DB,
 * drizzle, or fetch mocking.
 */
import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryDelivery, setDelivery } from "../delivery";
import { InMemoryTokenStore, setTokenStore } from "../recipe";
import { handleMessagingDeclineOutcome } from "../dispatcher";

const STUDENT_A_ID = "student-a-id";
const STUDENT_B_ID = "student-b-id";

const delivery = new InMemoryDelivery();
const tokens = new InMemoryTokenStore();

beforeEach(() => {
  delivery.reset();
  tokens.reset();
  setDelivery(delivery);
  setTokenStore(tokens);
});

describe("#142 — Notify both Students on decline outcome", () => {
  it("sends decline notification to both Students", async () => {
    tokens.set(STUDENT_A_ID, [{ id: "tok-a", token: "ExponentPushToken[alice]" }]);
    tokens.set(STUDENT_B_ID, [{ id: "tok-b", token: "ExponentPushToken[bob]" }]);

    await handleMessagingDeclineOutcome({ meetupId: "meetup-1", studentAId: STUDENT_A_ID, studentBId: STUDENT_B_ID });

    expect(delivery.sent).toHaveLength(1);
    const messages = delivery.sent[0]!;
    expect(messages).toHaveLength(2);
    const tokenList = messages.map((m) => m.to);
    expect(tokenList).toContain("ExponentPushToken[alice]");
    expect(tokenList).toContain("ExponentPushToken[bob]");
    messages.forEach((m) => {
      expect(m.title).toBe("Messaging not available");
      expect(m.data?.type).toBe("messaging_decline_outcome");
    });
  });

  it("sends no notification when neither Student has a device token", async () => {
    await handleMessagingDeclineOutcome({ meetupId: "meetup-1", studentAId: STUDENT_A_ID, studentBId: STUDENT_B_ID });
    expect(delivery.sent).toHaveLength(0);
  });
});
