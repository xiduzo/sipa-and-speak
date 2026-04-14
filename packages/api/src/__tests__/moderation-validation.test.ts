/**
 * Tests for task #67 — Validate flag (no self-flagging, no duplicate open flag)
 *
 * Covers:
 *   - Self-flag rejected
 *   - Duplicate open flag rejected
 *   - Valid flag (different users, no existing open flag) passes
 *   - Rapid duplicate submissions: second request sees count > 0 → rejected
 *   - Resolved flag does not block new flag (count = 0)
 */
import { describe, it, expect } from "bun:test";

import {
  checkSelfFlag,
  checkDuplicateOpenFlag,
  FLAG_VALIDATION_MESSAGES,
} from "../routers/moderation-utils";

describe("#67 — checkSelfFlag", () => {
  it("rejects flag where reporter and target are the same user", () => {
    const result = checkSelfFlag("user-a", "user-a");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe("SELF_FLAG");
  });

  it("accepts flag where reporter and target are different users", () => {
    const result = checkSelfFlag("user-a", "user-b");
    expect(result.valid).toBe(true);
  });

  it("SELF_FLAG message does not expose internal state", () => {
    expect(FLAG_VALIDATION_MESSAGES.SELF_FLAG).toBeTruthy();
    expect(FLAG_VALIDATION_MESSAGES.SELF_FLAG).not.toContain("user_flag");
    expect(FLAG_VALIDATION_MESSAGES.SELF_FLAG).not.toContain("database");
  });
});

describe("#67 — checkDuplicateOpenFlag", () => {
  it("rejects when an open flag already exists (count = 1)", () => {
    const result = checkDuplicateOpenFlag(1);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe("DUPLICATE_OPEN_FLAG");
  });

  it("rejects rapid duplicate (count > 1 from concurrent inserts)", () => {
    const result = checkDuplicateOpenFlag(2);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe("DUPLICATE_OPEN_FLAG");
  });

  it("accepts when no open flag exists (count = 0)", () => {
    const result = checkDuplicateOpenFlag(0);
    expect(result.valid).toBe(true);
  });

  it("accepts when prior flag is resolved (count = 0 because only open flags are counted)", () => {
    // Caller filters by status = 'open' — resolved flags yield count = 0
    const result = checkDuplicateOpenFlag(0);
    expect(result.valid).toBe(true);
  });

  it("DUPLICATE_OPEN_FLAG message does not expose internal state", () => {
    expect(FLAG_VALIDATION_MESSAGES.DUPLICATE_OPEN_FLAG).toBeTruthy();
    expect(FLAG_VALIDATION_MESSAGES.DUPLICATE_OPEN_FLAG).not.toContain("user_flag");
    expect(FLAG_VALIDATION_MESSAGES.DUPLICATE_OPEN_FLAG).not.toContain("database");
  });
});
