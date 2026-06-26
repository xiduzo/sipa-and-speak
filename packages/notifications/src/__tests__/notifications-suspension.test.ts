/**
 * Tests for:
 *   task #102 — Cancel active proposals on Student suspension + notify peers
 *   task #104 — Notify suspended Student of the moderation decision
 *   task #106 — Notify Student when suspension is lifted
 *
 * The proposal cancellation (DB side) and peer-id resolution now live in the
 * moderation context handlers. The notifications package subscribes to
 * ProposalsCancelledByCascade (which carries peer IDs) instead of re-querying.
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

function setup() {
  delivery.reset();
  tokens.reset();
  setDelivery(delivery);
  setTokenStore(tokens);
  domainEvents.removeAllListeners();
  registerNotificationHandlers();
}

describe("handleStudentSuspended — proposal cancellation (#102)", () => {
  beforeEach(setup);
  afterEach(() => domainEvents.removeAllListeners());

  it("notifies affected peer when proposal is cancelled", async () => {
    tokens.set("student-2", [{ id: "peer-tok", token: "ExponentPushToken[peer]" }]);
    domainEvents.emit("ProposalsCancelledByCascade", { targetId: "student-1", peerIds: ["student-2"] });
    await flush();
    const batch = delivery.sent.find((b) => b[0]?.title === "Meetup proposal cancelled");
    expect(batch).toBeDefined();
    expect(batch![0]!.body).toBe("Your meetup proposal has been cancelled.");
  });

  it("notification does not reveal moderation reason", async () => {
    tokens.set("student-2", [{ id: "peer-tok", token: "ExponentPushToken[peer]" }]);
    domainEvents.emit("ProposalsCancelledByCascade", { targetId: "student-1", peerIds: ["student-2"] });
    await flush();
    const batch = delivery.sent.find((b) => b[0]?.title === "Meetup proposal cancelled");
    expect(batch![0]!.body).not.toContain("suspend");
    expect(batch![0]!.body).not.toContain("moderation");
  });

  it("does not push proposal-cancelled when peerIds is empty", async () => {
    domainEvents.emit("ProposalsCancelledByCascade", { targetId: "student-1", peerIds: [] });
    await flush();
    const batch = delivery.sent.find((b) => b[0]?.title === "Meetup proposal cancelled");
    expect(batch).toBeUndefined();
  });
});

describe("handleSuspensionLifted — notify Student (#106)", () => {
  beforeEach(setup);
  afterEach(() => domainEvents.removeAllListeners());

  it("notifies Student when suspension is lifted", async () => {
    tokens.set("student-1", [{ id: "s-tok", token: "ExponentPushToken[student]" }]);
    domainEvents.emit("SuspensionLifted", { targetId: "student-1", moderatorId: "mod-1", liftedAt: new Date() });
    await flush();
    const batch = delivery.sent.find((b) => b[0]?.title === "Suspension lifted");
    expect(batch).toBeDefined();
  });

  it("sends no notification when Student has no device token", async () => {
    domainEvents.emit("SuspensionLifted", { targetId: "student-2", moderatorId: "mod-1", liftedAt: new Date() });
    await flush();
    expect(delivery.sent.filter((b) => b[0]?.title === "Suspension lifted").length).toBe(0);
  });
});
