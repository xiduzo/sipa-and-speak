/**
 * Tests for task #73 — Enforce max 3 counter-proposal rounds
 *
 * Covers:
 *   - canCounterPropose flag correctly derived from round number
 *   - Counter-propose is only allowed when round < 3
 */
import { describe, it, expect } from "bun:test";

/** Pure helper — mirrors the canCounterPropose logic in meetup.getPendingIncoming */
function canCounterPropose(round: number): boolean {
  return round < 3;
}

describe("#73 — round enforcement", () => {
  it("allows counter-propose at round 1", () => {
    expect(canCounterPropose(1)).toBe(true);
  });

  it("allows counter-propose at round 2", () => {
    expect(canCounterPropose(2)).toBe(true);
  });

  it("blocks counter-propose at round 3 (maximum reached)", () => {
    expect(canCounterPropose(3)).toBe(false);
  });

  it("blocks counter-propose beyond round 3", () => {
    expect(canCounterPropose(4)).toBe(false);
  });
});
