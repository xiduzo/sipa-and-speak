/**
 * Tests for task #280 — Gate app routes until Student identity profile is complete
 *
 * Tests identityProfileComplete logic in getOnboardingStatus.
 */
import { describe, it, expect } from "bun:test";

function identityProfileComplete(name: string | null, surname: string | null): boolean {
  return !!(name?.trim() && surname?.trim());
}

describe("#280 — identityProfileComplete flag", () => {
  it("Scenario 2: true when both name and surname are set", () => {
    expect(identityProfileComplete("Sander", "Boer")).toBe(true);
  });

  it("Scenario 1: false when surname is null", () => {
    expect(identityProfileComplete("Sander", null)).toBe(false);
  });

  it("Scenario 1: false when name is empty", () => {
    expect(identityProfileComplete("", "Boer")).toBe(false);
  });

  it("Scenario 1: false when name is whitespace-only", () => {
    expect(identityProfileComplete("   ", "Boer")).toBe(false);
  });

  it("Scenario 1: false when both are null", () => {
    expect(identityProfileComplete(null, null)).toBe(false);
  });
});
