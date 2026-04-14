/**
 * Tests for task #72 — Persist flag and add to Moderator review queue
 *
 * Covers pure helpers — no DB interaction.
 *
 *   - buildFlagValues: produces correct payload with status 'open'
 *   - buildFlagValues: optional detail is omitted when not provided
 *   - buildStudentFlaggedEvent: maps persisted flag fields to domain event payload
 */
import { describe, it, expect } from "bun:test";

import {
  buildFlagValues,
  buildStudentFlaggedEvent,
} from "../routers/moderation-utils";

describe("#72 — buildFlagValues", () => {
  it("returns correct payload with status 'open'", () => {
    const result = buildFlagValues({
      reporterId: "user-1",
      targetId: "user-2",
      reason: "HARASSMENT",
      detail: "They sent threatening messages.",
    });

    expect(result).toEqual({
      reporterId: "user-1",
      targetId: "user-2",
      reason: "HARASSMENT",
      detail: "They sent threatening messages.",
      status: "open",
    });
  });

  it("status is always 'open' regardless of input", () => {
    const result = buildFlagValues({
      reporterId: "user-1",
      targetId: "user-2",
      reason: "SPAM",
    });

    expect(result.status).toBe("open");
  });

  it("detail is undefined when not provided", () => {
    const result = buildFlagValues({
      reporterId: "user-1",
      targetId: "user-2",
      reason: "OTHER",
    });

    expect(result.detail).toBeUndefined();
  });
});

describe("#72 — buildStudentFlaggedEvent", () => {
  it("maps flag row to correct domain event payload", () => {
    const flaggedAt = new Date("2026-04-14T10:00:00Z");

    const result = buildStudentFlaggedEvent(
      "flag-abc",
      { reporterId: "user-1", targetId: "user-2", reason: "OFFENSIVE_LANGUAGE" },
      flaggedAt,
    );

    expect(result).toEqual({
      flagId: "flag-abc",
      reporterId: "user-1",
      targetId: "user-2",
      reason: "OFFENSIVE_LANGUAGE",
      flaggedAt,
    });
  });
});
