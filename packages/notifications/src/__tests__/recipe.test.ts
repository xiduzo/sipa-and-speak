/**
 * Seam tests for the notification dispatch pipeline.
 *
 * Proves the dispatch seam with ZERO module mocks:
 *   - `toDeliveryMessages` and `staleTokenIds` are pure and tested directly.
 *   - `dispatch` is exercised through the injectable `setDelivery` /
 *     `setTokenStore` seams, asserting on `InMemoryDelivery.sent` and the
 *     in-memory store's pruned token ids — no DB, drizzle, or fetch mocking.
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
  InMemoryDelivery,
  setDelivery,
  type DeliveryTicket,
  type NotificationDelivery,
} from "../delivery";
import {
  dispatch,
  staleTokenIds,
  toDeliveryMessages,
  InMemoryTokenStore,
  setTokenStore,
  type Recipe,
  type TokenRow,
} from "../recipe";

// ── toDeliveryMessages (pure) ───────────────────────────────────────────────────

describe("toDeliveryMessages", () => {
  it("maps each recipient token to a delivery message with aligned token ids", () => {
    const recipes: Recipe[] = [
      {
        recipientId: "u1",
        title: "Hi",
        body: "There",
        data: { type: "x" },
        category: "cat",
      },
    ];
    const tokens = new Map<string, TokenRow[]>([
      ["u1", [{ id: "tok-1", token: "ExponentPushToken[a]" }]],
    ]);

    const { messages, tokenIds } = toDeliveryMessages(recipes, tokens);

    expect(messages).toEqual([
      {
        to: "ExponentPushToken[a]",
        title: "Hi",
        body: "There",
        data: { type: "x" },
        categoryIdentifier: "cat",
      },
    ]);
    expect(tokenIds).toEqual(["tok-1"]);
  });

  it("emits one message per token when a recipient has multiple devices", () => {
    const recipes: Recipe[] = [{ recipientId: "u1", title: "T", body: "B" }];
    const tokens = new Map<string, TokenRow[]>([
      [
        "u1",
        [
          { id: "tok-1", token: "ExponentPushToken[a]" },
          { id: "tok-2", token: "ExponentPushToken[b]" },
        ],
      ],
    ]);

    const { messages, tokenIds } = toDeliveryMessages(recipes, tokens);

    expect(messages.map((m) => m.to)).toEqual([
      "ExponentPushToken[a]",
      "ExponentPushToken[b]",
    ]);
    expect(tokenIds).toEqual(["tok-1", "tok-2"]);
  });

  it("skips recipients that have no registered tokens", () => {
    const recipes: Recipe[] = [
      { recipientId: "u1", title: "T", body: "B" },
      { recipientId: "u2", title: "T", body: "B" },
    ];
    const tokens = new Map<string, TokenRow[]>([
      ["u1", [{ id: "tok-1", token: "ExponentPushToken[a]" }]],
      // u2 has no entry
    ]);

    const { messages, tokenIds } = toDeliveryMessages(recipes, tokens);

    expect(messages).toHaveLength(1);
    expect(tokenIds).toEqual(["tok-1"]);
  });

  it("returns empty arrays for no recipes", () => {
    expect(toDeliveryMessages([], new Map())).toEqual({ messages: [], tokenIds: [] });
  });
});

// ── staleTokenIds (pure) ─────────────────────────────────────────────────────────

describe("staleTokenIds", () => {
  it("returns ids of tokens Expo reports as DeviceNotRegistered", () => {
    const tickets: DeliveryTicket[] = [
      { status: "ok", id: "ticket-1" },
      { status: "error", details: { error: "DeviceNotRegistered" } },
    ];
    expect(staleTokenIds(tickets, ["tok-keep", "tok-stale"])).toEqual(["tok-stale"]);
  });

  it("ignores error tickets that are not DeviceNotRegistered", () => {
    const tickets: DeliveryTicket[] = [
      { status: "error", details: { error: "MessageRateExceeded" } },
    ];
    expect(staleTokenIds(tickets, ["tok-1"])).toEqual([]);
  });

  it("returns nothing when all tickets are ok", () => {
    const tickets: DeliveryTicket[] = [
      { status: "ok", id: "a" },
      { status: "ok", id: "b" },
    ];
    expect(staleTokenIds(tickets, ["tok-1", "tok-2"])).toEqual([]);
  });

  it("maps stale tickets back to tokens positionally", () => {
    const tickets: DeliveryTicket[] = [
      { status: "error", details: { error: "DeviceNotRegistered" } },
      { status: "ok", id: "b" },
      { status: "error", details: { error: "DeviceNotRegistered" } },
    ];
    expect(staleTokenIds(tickets, ["t0", "t1", "t2"])).toEqual(["t0", "t2"]);
  });
});

// ── dispatch (via injected seams) ────────────────────────────────────────────────

describe("dispatch", () => {
  const delivery = new InMemoryDelivery();
  const store = new InMemoryTokenStore();

  beforeEach(() => {
    delivery.reset();
    store.reset();
    setDelivery(delivery);
    setTokenStore(store);
  });

  it("short-circuits on empty recipes without touching delivery", async () => {
    await dispatch([]);
    expect(delivery.sent).toHaveLength(0);
  });

  it("sends nothing when no recipient has a registered token", async () => {
    await dispatch([{ recipientId: "u1", title: "T", body: "B" }]);
    expect(delivery.sent).toHaveLength(0);
  });

  it("delivers one batch of messages built from the loaded tokens", async () => {
    store.set("u1", [{ id: "tok-1", token: "ExponentPushToken[a]" }]);
    store.set("u2", [{ id: "tok-2", token: "ExponentPushToken[b]" }]);

    await dispatch([
      { recipientId: "u1", title: "Hello", body: "u1", data: { type: "x" } },
      { recipientId: "u2", title: "Hello", body: "u2" },
    ]);

    expect(delivery.sent).toHaveLength(1);
    const batch = delivery.sent[0]!;
    expect(batch.map((m) => m.to)).toEqual([
      "ExponentPushToken[a]",
      "ExponentPushToken[b]",
    ]);
    expect(batch[0]!.title).toBe("Hello");
    expect(store.removed).toHaveLength(0);
  });

  it("prunes tokens the delivery reports as DeviceNotRegistered", async () => {
    store.set("u1", [{ id: "stale-tok", token: "ExponentPushToken[gone]" }]);
    delivery.setNextTickets([{ status: "error", details: { error: "DeviceNotRegistered" } }]);

    await dispatch([{ recipientId: "u1", title: "T", body: "B" }]);

    expect(delivery.sent).toHaveLength(1);
    expect(store.removed).toEqual(["stale-tok"]);
  });

  it("does not prune tokens when delivery succeeds", async () => {
    store.set("u1", [{ id: "tok-1", token: "ExponentPushToken[ok]" }]);

    await dispatch([{ recipientId: "u1", title: "T", body: "B" }]);

    expect(store.removed).toHaveLength(0);
  });

  it("swallows delivery errors so callers never see a rejection", async () => {
    const errorSpy = spyOn(console, "error").mockImplementation(() => undefined);
    const failing: NotificationDelivery = {
      send: () => Promise.reject(new Error("network down")),
    };
    setDelivery(failing);
    store.set("u1", [{ id: "tok-1", token: "ExponentPushToken[a]" }]);

    await expect(dispatch([{ recipientId: "u1", title: "T", body: "B" }])).resolves.toBeUndefined();
    expect(store.removed).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  afterEach(() => {
    delivery.reset();
    store.reset();
  });
});
