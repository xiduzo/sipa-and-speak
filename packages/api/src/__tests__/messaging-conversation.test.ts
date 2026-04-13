/**
 * Tests for task #141 — Open conversation channel when both Students accept
 *
 * Covers:
 *   - bothAccepted returns true only when both responses are "accept"
 *   - Decline by either student prevents conversation opening
 */
import { describe, it, expect } from "bun:test";

import { bothAccepted } from "../routers/messaging-utils";

describe("#141 — bothAccepted", () => {
  it("returns true when both Students have accepted", () => {
    expect(
      bothAccepted([{ response: "accept" }, { response: "accept" }]),
    ).toBe(true);
  });

  it("returns false when only one Student has accepted", () => {
    expect(bothAccepted([{ response: "accept" }])).toBe(false);
  });

  it("returns false when first Student declined", () => {
    expect(
      bothAccepted([{ response: "decline" }, { response: "accept" }]),
    ).toBe(false);
  });

  it("returns false when second Student declined", () => {
    expect(
      bothAccepted([{ response: "accept" }, { response: "decline" }]),
    ).toBe(false);
  });

  it("returns false when both Students declined", () => {
    expect(
      bothAccepted([{ response: "decline" }, { response: "decline" }]),
    ).toBe(false);
  });

  it("returns false when no responses yet", () => {
    expect(bothAccepted([])).toBe(false);
  });
});
