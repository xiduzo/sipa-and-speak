/**
 * Tests for computeAttendanceOutcome — the pure decision function that determines
 * whether a S&S Moment transitions to Connected, returns to Matched, or is still pending.
 *
 * Covers:
 *   - "pending" when fewer than 2 reports exist
 *   - "completed" when both Students attended
 *   - "not_attended" when at least one Student did not attend
 */
import { describe, it, expect } from "bun:test";

import { computeAttendanceOutcome } from "../meetup-utils";

describe("computeAttendanceOutcome", () => {
  it("returns 'pending' when no reports exist yet", () => {
    expect(computeAttendanceOutcome([])).toBe("pending");
  });

  it("returns 'pending' when only one report exists", () => {
    expect(computeAttendanceOutcome([{ attended: true }])).toBe("pending");
    expect(computeAttendanceOutcome([{ attended: false }])).toBe("pending");
  });

  it("returns 'completed' when both Students attended", () => {
    expect(
      computeAttendanceOutcome([{ attended: true }, { attended: true }]),
    ).toBe("completed");
  });

  it("returns 'not_attended' when one Student did not attend", () => {
    expect(
      computeAttendanceOutcome([{ attended: true }, { attended: false }]),
    ).toBe("not_attended");
    expect(
      computeAttendanceOutcome([{ attended: false }, { attended: true }]),
    ).toBe("not_attended");
  });

  it("returns 'not_attended' when both Students did not attend", () => {
    expect(
      computeAttendanceOutcome([{ attended: false }, { attended: false }]),
    ).toBe("not_attended");
  });
});
