/**
 * Tests for task #83 — Push notification on MeetupCancelled
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

const OTHER_STUDENT_ID = "user-b";

const delivery = new InMemoryDelivery();
const tokens = new InMemoryTokenStore();

const flush = () => new Promise((r) => setTimeout(r, 10));

describe("handleMeetupCancelled", () => {
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

  it("notifies the other Student when a meetup is cancelled", async () => {
    tokens.set(OTHER_STUDENT_ID, [{ id: "t-1", token: "ExponentPushToken[other]" }]);
    domainEvents.emit("MeetupCancelled", { meetupId: "m-1", cancelledById: "user-a", otherStudentId: OTHER_STUDENT_ID, cancelledAt: new Date() });
    await flush();
    expect(delivery.sent.length).toBe(1);
    expect(delivery.sent[0]![0]!.title).toBe("Meetup cancelled");
  });

  it("sends no notification when the other Student has no token", async () => {
    domainEvents.emit("MeetupCancelled", { meetupId: "m-2", cancelledById: "user-a", otherStudentId: OTHER_STUDENT_ID, cancelledAt: new Date() });
    await flush();
    expect(delivery.sent.length).toBe(0);
  });
});
