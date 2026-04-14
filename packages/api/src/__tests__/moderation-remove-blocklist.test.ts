/**
 * Tests for task #109 — Block removed Student's institutional email from future re-registration
 *
 * Covers pure helpers — no DB interaction.
 *
 *   - normalizeEmail: lowercases and trims before storage and comparison
 *   - isBlockedEmailRejection: maps blocked status to the correct rejection contract
 */
import { describe, it, expect } from "bun:test";

import {
  normalizeEmail,
  isBlockedEmailRejection,
} from "../routers/moderation-utils";

describe("#109 — normalizeEmail", () => {
  it("Normalises uppercase to lowercase", () => {
    expect(normalizeEmail("Jane@STUDENT.TUE.NL")).toBe("jane@student.tue.nl");
  });

  it("Trims leading and trailing whitespace", () => {
    expect(normalizeEmail("  jane@student.tue.nl  ")).toBe("jane@student.tue.nl");
  });

  it("Already normalised email is unchanged", () => {
    expect(normalizeEmail("jane@student.tue.nl")).toBe("jane@student.tue.nl");
  });
});

describe("#109 — isBlockedEmailRejection", () => {
  it("Returns true for a blocklisted email (blocked=true)", () => {
    expect(isBlockedEmailRejection(true)).toBe(true);
  });

  it("Returns false for a non-blocklisted email (blocked=false)", () => {
    expect(isBlockedEmailRejection(false)).toBe(false);
  });
});
