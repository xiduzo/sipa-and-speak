/**
 * Tests for task #108 — Deactivate removed Student's account (block login)
 *
 * Covers pure helpers — no DB interaction.
 *
 *   - buildRemoveFlagValues: status='resolved', outcome='removed', moderatorId, resolvedAt
 *   - buildStudentRemovedEvent: correct payload shape
 *   - buildFlagDetail: removed field reflects studentStatus='removed'
 *   - checkStudentRemoved: idempotency guard
 */
import { describe, it, expect } from "bun:test";

import {
  buildRemoveFlagValues,
  buildStudentRemovedEvent,
  buildFlagDetail,
  checkStudentRemoved,
} from "../routers/moderation-utils";

describe("#108 — buildRemoveFlagValues", () => {
  it("sets status=resolved, outcome=removed", () => {
    const resolvedAt = new Date("2026-04-14T12:00:00Z");
    const result = buildRemoveFlagValues("mod-1", resolvedAt);

    expect(result).toEqual({
      status: "resolved",
      outcome: "removed",
      moderatorId: "mod-1",
      resolvedAt,
    });
  });

  it("flag transitions to resolved after remove: status is always 'resolved'", () => {
    const result = buildRemoveFlagValues("mod-1", new Date());
    expect(result.status).toBe("resolved");
    expect(result.outcome).toBe("removed");
  });
});

describe("#108 — buildStudentRemovedEvent", () => {
  it("StudentRemoved domain event emitted with correct payload", () => {
    const removedAt = new Date("2026-04-14T12:00:00Z");
    const result = buildStudentRemovedEvent("flag-1", "student-1", "mod-1", removedAt);

    expect(result).toEqual({
      flagId: "flag-1",
      targetId: "student-1",
      moderatorId: "mod-1",
      removedAt,
    });
  });
});

describe("#108 — checkStudentRemoved (idempotency guard)", () => {
  it("Already-removed Student: returns true (is already removed)", () => {
    expect(checkStudentRemoved("removed")).toBe(true);
  });

  it("Active Student can be removed: returns false (not yet removed)", () => {
    expect(checkStudentRemoved("active")).toBe(false);
  });

  it("Suspended Student can be removed: returns false (not yet removed)", () => {
    expect(checkStudentRemoved("suspended")).toBe(false);
  });
});

describe("#108 — buildFlagDetail removed field (via studentStatus)", () => {
  const base = {
    id: "flag-1",
    targetId: "student-1",
    targetName: "Jane Doe",
    reason: "HARASSMENT",
    detail: null,
    createdAt: new Date("2026-01-01"),
  };

  it("Returns removed=true when studentStatus is 'removed'", () => {
    const result = buildFlagDetail({ ...base, targetStatus: "removed" }, []);
    expect(result.flaggedStudent.removed).toBe(true);
  });

  it("Returns removed=false when studentStatus is 'active'", () => {
    const result = buildFlagDetail({ ...base, targetStatus: "active" }, []);
    expect(result.flaggedStudent.removed).toBe(false);
  });

  it("Returns removed=false when studentStatus is 'suspended'", () => {
    const result = buildFlagDetail({ ...base, targetStatus: "suspended" }, []);
    expect(result.flaggedStudent.removed).toBe(false);
  });

  it("Returns removed=true when targetName is null (legacy removed proxy still works)", () => {
    const result = buildFlagDetail({ ...base, targetName: null, targetStatus: null }, []);
    expect(result.flaggedStudent.removed).toBe(true);
  });
});
