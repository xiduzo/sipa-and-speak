/**
 * Tests for task #73 — Enforce max counter-proposal rounds
 *
 * Covers:
 *   - canCounterPropose flag correctly derived from round number
 *   - Counter-propose is only allowed when round < 5
 */
import { describe, it, expect } from "bun:test";

import { canCounterPropose } from "../meetup-utils";

describe("#73 — round enforcement", () => {
  it("allows counter-propose at round 1", () => {
    expect(canCounterPropose(1)).toBe(true);
  });

  it("allows counter-propose at round 2", () => {
    expect(canCounterPropose(2)).toBe(true);
  });

  it("allows counter-propose at round 4", () => {
    expect(canCounterPropose(4)).toBe(true);
  });

  it("blocks counter-propose at round 5 (maximum reached)", () => {
    expect(canCounterPropose(5)).toBe(false);
  });

  it("blocks counter-propose beyond round 5", () => {
    expect(canCounterPropose(6)).toBe(false);
  });
});
