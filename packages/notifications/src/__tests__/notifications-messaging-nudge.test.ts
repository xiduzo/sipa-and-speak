/**
 * Tests for task #140 — Send second push to pending Student when their match accepts
 *
 * Covers:
 *   - Pending Student receives a nudge push when their match accepts
 *   - No nudge sent when pending Student has no device token
 *
 * Uses the dispatch seam (InMemoryDelivery + InMemoryTokenStore) — no DB,
 * drizzle, or fetch mocking.
 */
import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryDelivery, setDelivery } from "../delivery";
import { InMemoryTokenStore, setTokenStore } from "../recipe";
import { handleMessagingNudge } from "../dispatcher";

const ACCEPTING_STUDENT_ID = "student-a-id";
const PENDING_STUDENT_ID = "student-b-id";

const delivery = new InMemoryDelivery();
const tokens = new InMemoryTokenStore();

function makeNudgeEvent(
  overrides: Partial<{
    meetupId: string;
    acceptingStudentId: string;
    acceptingStudentName: string;
    pendingStudentId: string;
  }> = {},
) {
  return {
    meetupId: overrides.meetupId ?? "meetup-1",
    acceptingStudentId: overrides.acceptingStudentId ?? ACCEPTING_STUDENT_ID,
    acceptingStudentName: overrides.acceptingStudentName ?? "Alice",
    pendingStudentId: overrides.pendingStudentId ?? PENDING_STUDENT_ID,
  };
}

beforeEach(() => {
  delivery.reset();
  tokens.reset();
  setDelivery(delivery);
  setTokenStore(tokens);
});

describe("#140 — Send second push to pending Student when their match accepts", () => {
  it("sends a nudge push to the pending Student with the accepting Student's name", async () => {
    tokens.set(PENDING_STUDENT_ID, [{ id: "tok-b", token: "ExponentPushToken[bob]" }]);

    await handleMessagingNudge(makeNudgeEvent());

    expect(delivery.sent).toHaveLength(1);

    const messages = delivery.sent[0];
    if (!messages) throw new Error("Expected a delivery batch");
    expect(messages).toHaveLength(1);

    const msg = messages[0];
    if (!msg) throw new Error("Expected a message");

    expect(msg.to).toBe("ExponentPushToken[bob]");
    expect(msg.title).toBe("Your match wants to message you!");
    expect(msg.body).toContain("Alice");
    expect(msg.data?.type).toBe("messaging_nudge");
    expect(msg.data?.meetupId).toBe("meetup-1");
  });

  it("sends no notification when pending Student has no registered device token", async () => {
    await handleMessagingNudge(makeNudgeEvent());

    expect(delivery.sent).toHaveLength(0);
  });
});
