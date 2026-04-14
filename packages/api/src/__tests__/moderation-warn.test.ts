/**
 * Tests for task #90 — Record warning in Student flag history and mark flag as resolved
 *
 * Covers pure helpers — no DB interaction.
 *
 *   - buildWarnFlagValues: status='resolved', outcome='warned', moderatorId, resolvedAt
 *   - buildStudentWarnedEvent: correct payload shape
 *   - canWarnFlag: only allows warn when status is 'open'
 */
import { describe, it, expect } from "bun:test";

import {
  buildWarnFlagValues,
  buildStudentWarnedEvent,
  canWarnFlag,
} from "../routers/moderation-utils";

describe("#90 — buildWarnFlagValues", () => {
  it("Warning recorded in flag history: sets status=resolved, outcome=warned, moderatorId, resolvedAt", () => {
    const resolvedAt = new Date("2026-04-14T12:00:00Z");
    const result = buildWarnFlagValues("mod-1", resolvedAt);

    expect(result).toEqual({
      status: "resolved",
      outcome: "warned",
      moderatorId: "mod-1",
      resolvedAt,
    });
  });

  it("Flag transitions to resolved after warn: status is always 'resolved'", () => {
    const result = buildWarnFlagValues("mod-1", new Date());

    expect(result.status).toBe("resolved");
    expect(result.outcome).toBe("warned");
  });

  it("Warned Student remains active: no user-level status field in warn payload", () => {
    const result = buildWarnFlagValues("mod-1", new Date());

    // Warn payload only touches the flag — no user status field present
    expect("userStatus" in result).toBe(false);
  });
});

describe("#90 — buildStudentWarnedEvent", () => {
  it("StudentWarned domain event is emitted with correct flagId and targetId", () => {
    const warnedAt = new Date("2026-04-14T12:00:00Z");
    const result = buildStudentWarnedEvent("flag-1", "student-2", "mod-1", warnedAt);

    expect(result).toEqual({
      flagId: "flag-1",
      targetId: "student-2",
      moderatorId: "mod-1",
      warnedAt,
    });
  });
});

describe("#90 — canWarnFlag", () => {
  it("Concurrent warn on already-resolved flag is rejected: returns false for resolved", () => {
    expect(canWarnFlag("resolved")).toBe(false);
  });

  it("returns true only when status is 'open'", () => {
    expect(canWarnFlag("open")).toBe(true);
  });

  it("returns false for any non-open status", () => {
    expect(canWarnFlag("suspended")).toBe(false);
    expect(canWarnFlag("removed")).toBe(false);
    expect(canWarnFlag("")).toBe(false);
  });
});
