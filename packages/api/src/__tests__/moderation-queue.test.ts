/**
 * Tests for task #78 — Build Moderator flag queue view (open flags sorted oldest first)
 *
 * Covers:
 *   - Oldest flag appears first in sorted results
 *   - buildFlagQueueEntry maps DB row to correct API response shape
 *   - isOpenFlag rejects resolved flags (drives the WHERE status='open' filter)
 */
import { describe, it, expect } from "bun:test";

import {
  buildFlagQueueEntry,
  sortFlagsOldestFirst,
  isOpenFlag,
} from "../routers/moderation-utils";

describe("#78 — sortFlagsOldestFirst", () => {
  it("places the flag submitted 2 days ago before the flag submitted 1 day ago", () => {
    const older = { id: "flag-1", createdAt: new Date("2026-04-12T10:00:00Z") };
    const newer = { id: "flag-2", createdAt: new Date("2026-04-13T10:00:00Z") };

    const result = sortFlagsOldestFirst([newer, older]);

    expect(result[0]!.id).toBe("flag-1");
    expect(result[1]!.id).toBe("flag-2");
  });

  it("does not mutate the original array", () => {
    const flags = [
      { id: "flag-2", createdAt: new Date("2026-04-13T10:00:00Z") },
      { id: "flag-1", createdAt: new Date("2026-04-12T10:00:00Z") },
    ];
    sortFlagsOldestFirst(flags);
    expect(flags[0]!.id).toBe("flag-2");
  });

  it("returns single-element array unchanged", () => {
    const flags = [{ id: "flag-1", createdAt: new Date("2026-04-12T10:00:00Z") }];
    expect(sortFlagsOldestFirst(flags)).toHaveLength(1);
  });
});

describe("#78 — buildFlagQueueEntry", () => {
  it("maps DB row to API response with correct shape", () => {
    const submittedAt = new Date("2026-04-10T09:15:00Z");
    const row = {
      id: "flag-abc",
      targetId: "user-2",
      targetName: "Jane Doe",
      reason: "Disruptive behaviour during session",
      createdAt: submittedAt,
    };

    const result = buildFlagQueueEntry(row);

    expect(result).toEqual({
      flagId: "flag-abc",
      flaggedStudent: { id: "user-2", name: "Jane Doe" },
      reason: "Disruptive behaviour during session",
      submittedAt: submittedAt.toISOString(),
    });
  });

  it("handles null targetName (removed Student) gracefully", () => {
    const row = {
      id: "flag-xyz",
      targetId: "user-3",
      targetName: null,
      reason: "SPAM",
      createdAt: new Date("2026-04-11T08:00:00Z"),
    };

    const result = buildFlagQueueEntry(row);
    expect(result.flaggedStudent.name).toBeNull();
  });
});

describe("#78 — isOpenFlag", () => {
  it("returns true for status 'open'", () => {
    expect(isOpenFlag("open")).toBe(true);
  });

  it("returns false for status 'resolved'", () => {
    expect(isOpenFlag("resolved")).toBe(false);
  });

  it("returns false for any other status", () => {
    expect(isOpenFlag("warned")).toBe(false);
    expect(isOpenFlag("suspended")).toBe(false);
  });
});
