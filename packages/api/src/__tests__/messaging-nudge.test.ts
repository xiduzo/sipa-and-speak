/**
 * Tests for task #140 — Send second push to pending Student when their match accepts
 *
 * Covers:
 *   - shouldSendNudge returns true when student accepts and partner hasn't responded
 *   - shouldSendNudge returns false when partner has already responded
 *   - shouldSendNudge returns false when student declines (no nudge on decline)
 */
import { describe, it, expect } from "bun:test";

import { shouldSendNudge } from "../routers/messaging-utils";

describe("#140 — shouldSendNudge", () => {
  it("returns true when accepting student's partner has not yet responded", () => {
    expect(shouldSendNudge("accept", undefined)).toBe(true);
  });

  it("returns false when partner has already accepted (both responded)", () => {
    expect(shouldSendNudge("accept", { response: "accept" })).toBe(false);
  });

  it("returns false when partner has already declined (both responded)", () => {
    expect(shouldSendNudge("accept", { response: "decline" })).toBe(false);
  });

  it("returns false when student declines (no nudge on decline path)", () => {
    expect(shouldSendNudge("decline", undefined)).toBe(false);
  });
});
