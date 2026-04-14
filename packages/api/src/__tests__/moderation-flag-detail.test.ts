/**
 * Tests for task #80 — Build flag detail view (flagged Student, reason, prior flag history)
 *
 * Covers:
 *   - Full flag detail shape with correct fields
 *   - Prior flag history included in response
 *   - Empty prior history shows empty array
 *   - Removed Student indicated via removed: true
 */
import { describe, it, expect } from "bun:test";

import { buildFlagDetail } from "../routers/moderation-utils";

const baseFlag = {
  id: "flag-abc",
  targetId: "user-2",
  targetName: "Jane Doe",
  targetStatus: "active" as string | null,
  reason: "Disruptive behaviour",
  detail: "Kept interrupting",
  createdAt: new Date("2026-04-10T09:15:00Z"),
};

describe("#80 — buildFlagDetail", () => {
  it("maps DB row to correct API response shape with full detail", () => {
    const result = buildFlagDetail(baseFlag, []);

    expect(result.flagId).toBe("flag-abc");
    expect(result.flaggedStudent).toEqual({ id: "user-2", name: "Jane Doe", removed: false, suspended: false });
    expect(result.reason).toBe("Disruptive behaviour");
    expect(result.detail).toBe("Kept interrupting");
    expect(result.submittedAt).toBe("2026-04-10T09:15:00.000Z");
    expect(result.priorFlags).toEqual([]);
  });

  it("includes prior resolved flag history in response", () => {
    const prior = {
      reason: "Aggressive tone",
      outcome: "resolved",
      createdAt: new Date("2026-03-01T11:00:00Z"),
    };

    const result = buildFlagDetail(baseFlag, [prior]);

    expect(result.priorFlags).toHaveLength(1);
    expect(result.priorFlags[0]!.reason).toBe("Aggressive tone");
    expect(result.priorFlags[0]!.resolvedAt).toBe("2026-03-01T11:00:00.000Z");
  });

  it("returns empty priorFlags array when Student has no prior resolved flags", () => {
    const result = buildFlagDetail(baseFlag, []);

    expect(result.priorFlags).toEqual([]);
  });

  it("sets removed: true when flagged Student's name is null (user record absent)", () => {
    const removedStudentFlag = { ...baseFlag, targetName: null, targetStatus: null };

    const result = buildFlagDetail(removedStudentFlag, []);

    expect(result.flaggedStudent.removed).toBe(true);
    expect(result.flaggedStudent.name).toBeNull();
  });

  it("sets removed: false when Student name is present", () => {
    const result = buildFlagDetail(baseFlag, []);

    expect(result.flaggedStudent.removed).toBe(false);
  });
});
