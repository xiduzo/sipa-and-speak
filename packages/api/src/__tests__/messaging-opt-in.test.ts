/**
 * Tests for task #139 — Record each Student's messaging opt-in response independently
 *
 * Covers:
 *   - Student accepts messaging opt-in
 *   - Student declines messaging opt-in
 *   - Student attempts to respond twice (duplicate prevention)
 */
import { describe, it, expect } from "bun:test";

import { hasAlreadyResponded, getPartnerId } from "../routers/messaging-utils";

describe("#139 — hasAlreadyResponded", () => {
  it("returns false when no existing response (student has not yet responded)", () => {
    expect(hasAlreadyResponded(undefined)).toBe(false);
  });

  it("returns true when student has already accepted", () => {
    expect(hasAlreadyResponded({ response: "accept" })).toBe(true);
  });

  it("returns true when student has already declined", () => {
    expect(hasAlreadyResponded({ response: "decline" })).toBe(true);
  });
});

describe("#139 — getPartnerId", () => {
  it("returns receiverId when student is the proposer", () => {
    expect(getPartnerId("proposer-A", "receiver-B", "proposer-A")).toBe("receiver-B");
  });

  it("returns proposerId when student is the receiver", () => {
    expect(getPartnerId("proposer-A", "receiver-B", "receiver-B")).toBe("proposer-A");
  });
});
