/**
 * Tests for task #142 — Block conversation when either Student declines
 */
import { describe, it, expect } from "bun:test";
import { isDeclineOutcome } from "../routers/messaging-utils";

describe("#142 — isDeclineOutcome", () => {
  it("returns true when second Student declines after first accepted", () => {
    expect(isDeclineOutcome([{ response: "accept" }, { response: "decline" }])).toBe(true);
  });
  it("returns true when first Student declines before second accepts", () => {
    expect(isDeclineOutcome([{ response: "decline" }, { response: "accept" }])).toBe(true);
  });
  it("returns true when both Students decline", () => {
    expect(isDeclineOutcome([{ response: "decline" }, { response: "decline" }])).toBe(true);
  });
  it("returns false when both accepted (conversation path)", () => {
    expect(isDeclineOutcome([{ response: "accept" }, { response: "accept" }])).toBe(false);
  });
  it("returns false when only one has responded", () => {
    expect(isDeclineOutcome([{ response: "decline" }])).toBe(false);
  });
});
