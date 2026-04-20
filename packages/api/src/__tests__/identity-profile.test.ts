/**
 * Tests for task #277 — tRPC procedures to set and update Student identity profile
 *
 * Scenario 1: Student sets their identity profile for the first time
 * Scenario 2: Student updates their identity profile
 * Scenario 3: Student submits without a name or surname (validation)
 * Scenario 4: Unauthenticated request is rejected (tRPC auth guard)
 */
import { describe, it, expect } from "bun:test";
import { determineIdentityProfileEvent } from "../routers/profile-utils";

describe("#277 — determineIdentityProfileEvent", () => {
  describe("Scenario 1: first-time profile setup", () => {
    it("emits StudentProfileCompleted when surname was NULL", () => {
      expect(determineIdentityProfileEvent(null)).toBe("StudentProfileCompleted");
    });
  });

  describe("Scenario 2: subsequent profile update", () => {
    it("emits StudentProfileUpdated when surname was already set", () => {
      expect(determineIdentityProfileEvent("Janssen")).toBe("StudentProfileUpdated");
    });

    it("emits StudentProfileUpdated for any non-null previous surname", () => {
      expect(determineIdentityProfileEvent("")).toBe("StudentProfileUpdated");
      expect(determineIdentityProfileEvent("Smith")).toBe("StudentProfileUpdated");
    });
  });
});
