/**
 * Tests for task #87 — Validate reschedule proposal
 * (future date/time, active location, no-op detection)
 *
 * Pure-function unit tests — no DB required.
 */
import { describe, expect, it } from "bun:test";

import { isMeetupInThePast, isRescheduleNoOp } from "../meetup-utils";

// ── isMeetupInThePast ─────────────────────────────────────────────────────────

describe("#87 — isMeetupInThePast", () => {
  it("returns false for a date far in the future", () => {
    expect(isMeetupInThePast(new Date("2099-12-31T23:59:00Z"))).toBe(false);
  });

  it("returns true for a date in the past", () => {
    expect(isMeetupInThePast(new Date("2020-01-01T10:00:00Z"))).toBe(true);
  });

  it("returns true for a date/time that has already passed", () => {
    expect(isMeetupInThePast(new Date("2000-06-15T14:30:00Z"))).toBe(true);
  });
});

// ── isRescheduleNoOp ──────────────────────────────────────────────────────────

describe("#87 — isRescheduleNoOp", () => {
  const at = new Date("2026-06-01T14:00:00Z");
  const otherAt = new Date("2026-07-01T14:00:00Z");
  const otherTime = new Date("2026-06-01T16:00:00Z");
  const current = { venueId: "venue-1", scheduledAt: at };

  it("returns true when both fields are identical", () => {
    expect(isRescheduleNoOp(current, { venueId: "venue-1", scheduledAt: new Date(at) })).toBe(true);
  });

  it("returns false when only the venue changes", () => {
    expect(isRescheduleNoOp(current, { venueId: "venue-2", scheduledAt: new Date(at) })).toBe(false);
  });

  it("returns false when only the date changes", () => {
    expect(isRescheduleNoOp(current, { venueId: "venue-1", scheduledAt: otherAt })).toBe(false);
  });

  it("returns false when only the time changes", () => {
    expect(isRescheduleNoOp(current, { venueId: "venue-1", scheduledAt: otherTime })).toBe(false);
  });

  it("returns false when both fields change", () => {
    expect(isRescheduleNoOp(current, { venueId: "venue-x", scheduledAt: new Date("2027-01-01T09:00:00Z") })).toBe(false);
  });
});
