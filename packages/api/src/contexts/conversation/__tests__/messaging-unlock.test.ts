/**
 * Tests for the messaging unlock rule — isMutuallyOptedIn / isOptInDeclineOutcome
 *
 * The single pure predicate behind #141 (open conversation) and #142 (decline
 * outcome), also applied by startConversation's authorization guard and the
 * per-meetup messaging state in queries.ts.
 *
 * Covers:
 *   - 0 responses never unlocks
 *   - 1 response (even an accept) never unlocks
 *   - 2 accepts unlocks
 *   - mixed accept/decline does not unlock
 *   - 2 declines does not unlock
 *   - null placeholders (mine/partner form) never unlock
 *   - decline outcome holds exactly when both responded and not both accepted
 */
import { describe, it, expect } from "bun:test";

import { isMutuallyOptedIn, isOptInDeclineOutcome } from "../messaging-utils";

describe("isMutuallyOptedIn", () => {
  it("returns false for zero responses", () => {
    expect(isMutuallyOptedIn([])).toBe(false);
  });

  it("returns false for a single accept", () => {
    expect(isMutuallyOptedIn(["accept"])).toBe(false);
  });

  it("returns false for a single decline", () => {
    expect(isMutuallyOptedIn(["decline"])).toBe(false);
  });

  it("returns true when both participants accepted", () => {
    expect(isMutuallyOptedIn(["accept", "accept"])).toBe(true);
  });

  it("returns false for mixed accept/decline (either order)", () => {
    expect(isMutuallyOptedIn(["accept", "decline"])).toBe(false);
    expect(isMutuallyOptedIn(["decline", "accept"])).toBe(false);
  });

  it("returns false when both declined", () => {
    expect(isMutuallyOptedIn(["decline", "decline"])).toBe(false);
  });

  it("treats a null placeholder as not-a-response (mine/partner form)", () => {
    expect(isMutuallyOptedIn([null, null])).toBe(false);
    expect(isMutuallyOptedIn(["accept", null])).toBe(false);
    expect(isMutuallyOptedIn([null, "accept"])).toBe(false);
  });
});

describe("isOptInDeclineOutcome", () => {
  it("returns false while responses are still pending", () => {
    expect(isOptInDeclineOutcome([])).toBe(false);
    expect(isOptInDeclineOutcome(["decline"])).toBe(false);
    expect(isOptInDeclineOutcome(["accept"])).toBe(false);
  });

  it("returns true when both responded and at least one declined", () => {
    expect(isOptInDeclineOutcome(["accept", "decline"])).toBe(true);
    expect(isOptInDeclineOutcome(["decline", "accept"])).toBe(true);
    expect(isOptInDeclineOutcome(["decline", "decline"])).toBe(true);
  });

  it("returns false when both accepted (that is the unlock, not the decline outcome)", () => {
    expect(isOptInDeclineOutcome(["accept", "accept"])).toBe(false);
  });
});
