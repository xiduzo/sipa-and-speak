/**
 * Tests for kept moderation-utils helpers after the shallow-extraction cleanup.
 * Covers buildFlagQueueEntry (non-trivial DB→API mapping) and normalizeEmail
 * (lowercase + trim invariant shared by blocklist write and read paths).
 */
import { describe, it, expect } from "bun:test";

import { buildFlagQueueEntry, normalizeEmail } from "../moderation-utils";

describe("buildFlagQueueEntry", () => {
  it("maps DB row to API response with correct shape", () => {
    const submittedAt = new Date("2026-04-10T09:15:00Z");
    const result = buildFlagQueueEntry({
      id: "flag-abc",
      targetId: "user-2",
      targetName: "Jane Doe",
      reason: "Disruptive behaviour during session",
      createdAt: submittedAt,
    });

    expect(result).toEqual({
      flagId: "flag-abc",
      flaggedStudent: { id: "user-2", name: "Jane Doe" },
      reason: "Disruptive behaviour during session",
      submittedAt: submittedAt.toISOString(),
    });
  });

  it("handles null targetName (removed Student) gracefully", () => {
    const result = buildFlagQueueEntry({
      id: "flag-xyz",
      targetId: "user-3",
      targetName: null,
      reason: "SPAM",
      createdAt: new Date("2026-04-11T08:00:00Z"),
    });
    expect(result.flaggedStudent.name).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("lowercases the input", () => {
    expect(normalizeEmail("Jane@STUDENT.TUE.NL")).toBe("jane@student.tue.nl");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeEmail("  jane@student.tue.nl  ")).toBe("jane@student.tue.nl");
  });

  it("leaves an already-normalised email unchanged", () => {
    expect(normalizeEmail("jane@student.tue.nl")).toBe("jane@student.tue.nl");
  });
});
