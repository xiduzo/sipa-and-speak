/**
 * Tests for task #144 — Validate message content before send
 *
 * Covers:
 *   - Empty message rejected
 *   - Whitespace-only message rejected
 *   - Valid message passes validation
 *   - Max-length constraint (2000 chars)
 */
import { describe, it, expect } from "bun:test";

import { validateMessageContent } from "../routers/messaging-utils";

describe("#144 — validateMessageContent", () => {
  it("rejects empty string", () => {
    const result = validateMessageContent("");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe("EMPTY_CONTENT");
  });

  it("rejects whitespace-only string", () => {
    const result = validateMessageContent("   ");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe("EMPTY_CONTENT");
  });

  it("accepts a valid message and returns trimmed content", () => {
    const result = validateMessageContent("  Hello!  ");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.trimmed).toBe("Hello!");
  });

  it("accepts a message at the max-length boundary (2000 chars)", () => {
    const result = validateMessageContent("a".repeat(2000));
    expect(result.valid).toBe(true);
  });

  it("rejects a message exceeding max length (2001 chars)", () => {
    const result = validateMessageContent("a".repeat(2001));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe("TOO_LONG");
  });
});
