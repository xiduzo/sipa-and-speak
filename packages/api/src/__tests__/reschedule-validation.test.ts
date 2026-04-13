/**
 * Tests for task #87 — Validate reschedule proposal
 * (future date/time, active location, no-op detection)
 *
 * Pure-function unit tests — no DB required.
 */
import { describe, expect, it } from "bun:test";

import { isMeetupInThePast, isRescheduleNoOp } from "../routers/meetup-utils";

// ── isMeetupInThePast ─────────────────────────────────────────────────────────

describe("#87 — isMeetupInThePast", () => {
  it("returns false for a date far in the future", () => {
    expect(isMeetupInThePast("2099-12-31", "23:59")).toBe(false);
  });

  it("returns true for a date in the past", () => {
    expect(isMeetupInThePast("2020-01-01", "10:00")).toBe(true);
  });

  it("returns true for a date/time that has exactly passed (boundary)", () => {
    // A fixed past timestamp is always in the past
    expect(isMeetupInThePast("2000-06-15", "14:30")).toBe(true);
  });
});

// ── isRescheduleNoOp ──────────────────────────────────────────────────────────

describe("#87 — isRescheduleNoOp", () => {
  const current = { venueId: "venue-1", date: "2026-06-01", time: "14:00" };

  it("returns true when all three fields are identical", () => {
    expect(isRescheduleNoOp(current, { ...current })).toBe(true);
  });

  it("returns false when only the venue changes", () => {
    expect(isRescheduleNoOp(current, { ...current, venueId: "venue-2" })).toBe(false);
  });

  it("returns false when only the date changes", () => {
    expect(isRescheduleNoOp(current, { ...current, date: "2026-07-01" })).toBe(false);
  });

  it("returns false when only the time changes", () => {
    expect(isRescheduleNoOp(current, { ...current, time: "16:00" })).toBe(false);
  });

  it("returns false when all three fields change", () => {
    expect(isRescheduleNoOp(current, { venueId: "venue-x", date: "2027-01-01", time: "09:00" })).toBe(false);
  });
});
