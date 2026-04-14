/**
 * Tests for task #100/#103 — Transition Student to Suspended state + record in flag history
 *
 * Covers pure helpers — no DB interaction.
 *
 *   - buildSuspendFlagValues: status='resolved', outcome='suspended', moderatorId, resolvedAt
 *   - buildStudentSuspendedEvent: correct payload shape
 *   - checkStudentActive: blocks on suspended or removed students
 *   - buildFlagDetail: suspended field reflects actual studentStatus
 */
import { describe, it, expect } from "bun:test";

import {
  buildSuspendFlagValues,
  buildStudentSuspendedEvent,
  checkStudentActive,
  buildFlagDetail,
} from "../routers/moderation-utils";

describe("#103 — buildSuspendFlagValues", () => {
  it("Suspension recorded in flag history: sets status=resolved, outcome=suspended", () => {
    const resolvedAt = new Date("2026-04-14T12:00:00Z");
    const result = buildSuspendFlagValues("mod-1", resolvedAt);

    expect(result).toEqual({
      status: "resolved",
      outcome: "suspended",
      moderatorId: "mod-1",
      resolvedAt,
    });
  });

  it("Flag transitions to resolved after suspend: status is always 'resolved'", () => {
    const result = buildSuspendFlagValues("mod-1", new Date());
    expect(result.status).toBe("resolved");
    expect(result.outcome).toBe("suspended");
  });
});

describe("#100 — buildStudentSuspendedEvent", () => {
  it("StudentSuspended domain event emitted with correct payload", () => {
    const suspendedAt = new Date("2026-04-14T12:00:00Z");
    const result = buildStudentSuspendedEvent("flag-1", "student-1", "mod-1", suspendedAt);

    expect(result).toEqual({
      flagId: "flag-1",
      targetId: "student-1",
      moderatorId: "mod-1",
      suspendedAt,
    });
  });
});

describe("#100 — checkStudentActive (suspend guard)", () => {
  it("Suspended Student cannot be suspended again: returns false when suspended=true", () => {
    expect(checkStudentActive(true, true)).toBe(false);
  });

  it("Removed Student cannot be suspended: returns false when exists=false", () => {
    expect(checkStudentActive(false, false)).toBe(false);
  });

  it("Active Student can be suspended: returns true when exists=true and suspended=false", () => {
    expect(checkStudentActive(true, false)).toBe(true);
  });
});

describe("#100 — buildFlagDetail suspended field", () => {
  const base = {
    id: "flag-1",
    targetId: "student-1",
    targetName: "Jane Doe",
    reason: "HARASSMENT",
    detail: null,
    createdAt: new Date("2026-01-01"),
  };

  it("Returns suspended=true when studentStatus is 'suspended'", () => {
    const result = buildFlagDetail({ ...base, targetStatus: "suspended" }, []);
    expect(result.flaggedStudent.suspended).toBe(true);
  });

  it("Returns suspended=false when studentStatus is 'active'", () => {
    const result = buildFlagDetail({ ...base, targetStatus: "active" }, []);
    expect(result.flaggedStudent.suspended).toBe(false);
  });

  it("Returns suspended=false when targetStatus is null (user removed)", () => {
    const result = buildFlagDetail({ ...base, targetStatus: null }, []);
    expect(result.flaggedStudent.suspended).toBe(false);
  });

  it("Returns removed=true and suspended=false when targetName is null", () => {
    const result = buildFlagDetail({ ...base, targetName: null, targetStatus: null }, []);
    expect(result.flaggedStudent.removed).toBe(true);
    expect(result.flaggedStudent.suspended).toBe(false);
  });
});
