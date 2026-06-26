/**
 * Tests for task #94 — Push notification on StudentWarned
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

const delivery = new InMemoryDelivery();
const tokens = new InMemoryTokenStore();

const flush = () => new Promise((r) => setTimeout(r, 10));

describe("handleStudentWarned", () => {
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

  it("sends push notification to warned Student's device", async () => {
    tokens.set("student-1", [{ id: "t-1", token: "ExponentPushToken[warned]" }]);
    domainEvents.emit("StudentWarned", { flagId: "flag-1", targetId: "student-1", moderatorId: "mod-1", warnedAt: new Date() });
    await flush();
    expect(delivery.sent.length).toBe(1);
    expect(delivery.sent[0]![0]!.to).toBe("ExponentPushToken[warned]");
    expect(delivery.sent[0]![0]!.title).toBe("Moderation notice");
    expect(delivery.sent[0]![0]!.data?.type).toBe("student_warned");
  });

  it("sends no notification when Student has no registered token", async () => {
    domainEvents.emit("StudentWarned", { flagId: "flag-2", targetId: "student-2", moderatorId: "mod-1", warnedAt: new Date() });
    await flush();
    expect(delivery.sent.length).toBe(0);
  });

  it("sends to all registered tokens when Student has multiple devices", async () => {
    tokens.set("student-3", [
      { id: "t-1", token: "ExponentPushToken[device1]" },
      { id: "t-2", token: "ExponentPushToken[device2]" },
    ]);
    domainEvents.emit("StudentWarned", { flagId: "flag-3", targetId: "student-3", moderatorId: "mod-1", warnedAt: new Date() });
    await flush();
    expect(delivery.sent.length).toBe(1);
    expect(delivery.sent[0]!.length).toBe(2);
  });
});
