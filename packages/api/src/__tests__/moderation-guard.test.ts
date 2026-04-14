/**
 * Tests for task #92 — Block warn action if Student is already suspended or removed
 */
import { describe, it, expect } from "bun:test";
import { checkStudentActive, STUDENT_INACTIVE_MESSAGE } from "../routers/moderation-utils";

describe("#92 — checkStudentActive", () => {
  it("Warn rejected for removed Student: returns false when student does not exist", () => {
    expect(checkStudentActive(false, false)).toBe(false);
  });

  it("Warn rejected for suspended Student: returns false when suspended", () => {
    expect(checkStudentActive(true, true)).toBe(false);
  });

  it("Warn proceeds for active Student: returns true when exists and not suspended", () => {
    expect(checkStudentActive(true, false)).toBe(true);
  });

  it("STUDENT_INACTIVE message is defined for UI display", () => {
    expect(STUDENT_INACTIVE_MESSAGE).toContain("Action no longer available");
  });
});
