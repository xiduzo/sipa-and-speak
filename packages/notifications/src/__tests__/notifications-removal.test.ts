/**
 * Tests for task #112 — Mark flag as resolved and notify the removed Student
 *
 * Covers:
 *   - Removed Student receives push notification
 *   - Notification failure does not roll back removal (dispatch never throws)
 *
 * Drives the real `domainEvents` wiring via `registerNotificationHandlers`, with
 * the dispatch seam (InMemoryDelivery + InMemoryTokenStore) replacing DB,
 * drizzle, and fetch mocks.
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { domainEvents } from "@sip-and-speak/api/domain-events";
import { InMemoryDelivery, setDelivery, type NotificationDelivery } from "../delivery";
import { InMemoryTokenStore, setTokenStore } from "../recipe";
import { registerNotificationHandlers } from "../dispatcher";

const delivery = new InMemoryDelivery();
const tokens = new InMemoryTokenStore();

const flush = () => new Promise((r) => setTimeout(r, 10));

describe("handleStudentRemovedNotify (#112)", () => {
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

  it("sends push notification to removed Student", async () => {
    tokens.set("student-1", [{ id: "tok-removed", token: "ExponentPushToken[removed-student]" }]);
    domainEvents.emit("StudentRemoved", { flagId: "flag-1", targetId: "student-1", moderatorId: "mod-1", removedAt: new Date() });
    await flush();
    const batch = delivery.sent.find((b) => b[0]?.title === "Your account has been removed");
    expect(batch).toBeDefined();
    expect(batch![0]!.to).toBe("ExponentPushToken[removed-student]");
  });

  it("no notification sent when Student has no device token", async () => {
    domainEvents.emit("StudentRemoved", { flagId: "flag-2", targetId: "student-2", moderatorId: "mod-1", removedAt: new Date() });
    await flush();
    const batch = delivery.sent.find((b) => b[0]?.title === "Your account has been removed");
    expect(batch).toBeUndefined();
  });

  it("notification failure does not throw — removal stands", async () => {
    const errorSpy = spyOn(console, "error").mockImplementation(() => undefined);
    const failing: NotificationDelivery = {
      send: () => Promise.reject(new Error("Expo push failed")),
    };
    setDelivery(failing);
    tokens.set("student-3", [{ id: "tok-3", token: "ExponentPushToken[student-3]" }]);
    // Should not throw / produce an unhandled rejection
    domainEvents.emit("StudentRemoved", { flagId: "flag-3", targetId: "student-3", moderatorId: "mod-1", removedAt: new Date() });
    await flush();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
