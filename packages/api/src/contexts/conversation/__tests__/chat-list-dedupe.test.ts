/**
 * Tests for chat-list dedupe — a user met more than once must appear only once in the chat tab.
 *
 * Covers `keptEntryKeysByPartner`:
 *   - Multiple open conversations with the same partner collapse to the most recent.
 *   - An open chat always wins over a locked meetup card for the same partner, even when the
 *     locked card is future-dated (a newly scheduled meet-up must not re-lock an open chat).
 *   - A stale locked card never hides a more recently active chat with the same partner.
 *   - Pre-meet locked cards for partners with no open chat still surface as locked.
 *   - Distinct partners are all kept.
 *   - Entries with an unknown partner are always kept (never collapsed into each other).
 */
import { describe, it, expect } from "bun:test";

import { keptEntryKeysByPartner } from "../messaging-utils";

const at = (iso: string) => new Date(iso);

describe("keptEntryKeysByPartner", () => {
  it("keeps only the most recent of two open conversations with the same partner", () => {
    const kept = keptEntryKeysByPartner([
      { kind: "open", id: "convOld", partner: { id: "bob" }, sortAt: at("2026-01-01T10:00:00Z") },
      { kind: "open", id: "convNew", partner: { id: "bob" }, sortAt: at("2026-02-01T10:00:00Z") },
    ]);
    expect(kept.has("open-convNew")).toBe(true);
    expect(kept.has("open-convOld")).toBe(false);
    expect(kept.size).toBe(1);
  });

  it("keeps the open chat over a future-dated locked meetup card with the same partner", () => {
    // A newly scheduled meet-up (future sortAt) must not re-lock an already-open chat.
    const kept = keptEntryKeysByPartner([
      { kind: "locked", id: "meetupUpcoming", partner: { id: "bob" }, sortAt: at("2026-03-01T10:00:00Z") },
      { kind: "open", id: "convStale", partner: { id: "bob" }, sortAt: at("2026-01-15T10:00:00Z") },
    ]);
    expect(kept.has("open-convStale")).toBe(true);
    expect(kept.has("locked-meetupUpcoming")).toBe(false);
    expect(kept.size).toBe(1);
  });

  it("keeps the open chat when a brand-new future meet-up is scheduled (order-independent)", () => {
    // Same as above but with the open chat listed first — open must win regardless of order.
    const now = at("2026-06-13T10:00:00Z");
    const kept = keptEntryKeysByPartner([
      { kind: "open", id: "convOpen", partner: { id: "bob" }, sortAt: at("2026-06-01T10:00:00Z") },
      { kind: "locked", id: "newMeetup", partner: { id: "bob" }, sortAt: new Date(now.getTime() + 86_400_000) },
    ]);
    expect(kept.has("open-convOpen")).toBe(true);
    expect(kept.has("locked-newMeetup")).toBe(false);
    expect(kept.size).toBe(1);
  });

  it("still surfaces a pre-meet locked card for a partner with no open chat", () => {
    const kept = keptEntryKeysByPartner([
      { kind: "locked", id: "meetupSoon", partner: { id: "carol" }, sortAt: at("2026-07-01T10:00:00Z") },
    ]);
    expect(kept.has("locked-meetupSoon")).toBe(true);
    expect(kept.size).toBe(1);
  });

  it("does not let a stale locked card hide a more recently active chat", () => {
    const kept = keptEntryKeysByPartner([
      { kind: "locked", id: "declinedLongAgo", partner: { id: "bob" }, sortAt: at("2025-09-01T10:00:00Z") },
      { kind: "open", id: "convActive", partner: { id: "bob" }, sortAt: at("2026-02-20T10:00:00Z") },
    ]);
    expect(kept.has("open-convActive")).toBe(true);
    expect(kept.has("locked-declinedLongAgo")).toBe(false);
  });

  it("keeps one entry per distinct partner", () => {
    const kept = keptEntryKeysByPartner([
      { kind: "open", id: "convA", partner: { id: "alice" }, sortAt: at("2026-01-01T10:00:00Z") },
      { kind: "open", id: "convB", partner: { id: "bob" }, sortAt: at("2026-01-01T10:00:00Z") },
      { kind: "locked", id: "meetupC", partner: { id: "carol" }, sortAt: at("2026-01-01T10:00:00Z") },
    ]);
    expect(kept.has("open-convA")).toBe(true);
    expect(kept.has("open-convB")).toBe(true);
    expect(kept.has("locked-meetupC")).toBe(true);
    expect(kept.size).toBe(3);
  });

  it("always keeps entries with an unknown partner instead of collapsing them", () => {
    const kept = keptEntryKeysByPartner([
      { kind: "open", id: "conv1", partner: null, sortAt: at("2026-01-01T10:00:00Z") },
      { kind: "open", id: "conv2", partner: null, sortAt: at("2026-01-02T10:00:00Z") },
    ]);
    expect(kept.has("open-conv1")).toBe(true);
    expect(kept.has("open-conv2")).toBe(true);
    expect(kept.size).toBe(2);
  });
});
