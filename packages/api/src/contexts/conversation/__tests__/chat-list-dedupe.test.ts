/**
 * Tests for chat-list dedupe — a user met more than once must appear only once in the chat tab.
 *
 * Covers `keptEntryKeysByPartner`:
 *   - Multiple open conversations with the same partner collapse to the most recent.
 *   - Open chats and locked meetup cards dedupe together (cross-kind), most recent wins.
 *   - A stale locked card never hides a more recently active chat with the same partner.
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

  it("dedupes a locked meetup card and an open chat with the same partner (most recent wins)", () => {
    const kept = keptEntryKeysByPartner([
      { kind: "locked", id: "meetupUpcoming", partner: { id: "bob" }, sortAt: at("2026-03-01T10:00:00Z") },
      { kind: "open", id: "convStale", partner: { id: "bob" }, sortAt: at("2026-01-15T10:00:00Z") },
    ]);
    expect(kept.has("locked-meetupUpcoming")).toBe(true);
    expect(kept.has("open-convStale")).toBe(false);
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
