import { describe, it, expect } from "bun:test";

import {
  OnboardingProgression,
  OnboardingRuleError,
  type OnboardingSnapshot,
} from "../onboarding-progression";

function snapshot(overrides: Partial<OnboardingSnapshot> = {}): OnboardingSnapshot {
  return {
    identity: { name: "Ada", surname: "Lovelace" },
    languages: [
      { language: "en", proficiency: "native", type: "spoken" },
      { language: "nl", proficiency: "beginner", type: "learning" },
    ],
    interestCount: 1,
    ...overrides,
  };
}

describe("OnboardingProgression.evaluate", () => {
  it("Registering when name/surname missing", () => {
    const s = OnboardingProgression.evaluate(
      snapshot({ identity: { name: null, surname: null } }),
    );
    expect(s.phase).toBe("Registering");
    expect(s.identityComplete).toBe(false);
    expect(s.matchingEligible).toBe(false);
    expect(s.missingFields).toContain("name");
    expect(s.missingFields).toContain("surname");
  });

  it("IdentitySet when identity present but profile incomplete (no interest)", () => {
    const s = OnboardingProgression.evaluate(snapshot({ interestCount: 0 }));
    expect(s.phase).toBe("IdentitySet");
    expect(s.identityComplete).toBe(true);
    expect(s.matchingEligible).toBe(false);
    expect(s.missingFields).toEqual(["interest"]);
  });

  it("IdentitySet when no learning language", () => {
    const s = OnboardingProgression.evaluate(
      snapshot({
        languages: [{ language: "en", proficiency: "native", type: "spoken" }],
      }),
    );
    expect(s.phase).toBe("IdentitySet");
    expect(s.missingFields).toEqual(["learning"]);
  });

  it("Submitted when identity + spoken + learning + interest all present", () => {
    const s = OnboardingProgression.evaluate(snapshot());
    expect(s.phase).toBe("Submitted");
    expect(s.matchingEligible).toBe(true);
    expect(s.missingFields).toEqual([]);
  });

  it("treats whitespace-only name as missing", () => {
    const s = OnboardingProgression.evaluate(
      snapshot({ identity: { name: "   ", surname: "Lovelace" } }),
    );
    expect(s.phase).toBe("Registering");
    expect(s.missingFields).toContain("name");
  });
});

describe("OnboardingProgression.assertCanSubmit", () => {
  it("passes when all three categories are present", () => {
    expect(() => OnboardingProgression.assertCanSubmit(snapshot())).not.toThrow();
  });

  it("throws when no spoken language", () => {
    expect(() =>
      OnboardingProgression.assertCanSubmit(
        snapshot({ languages: [{ language: "nl", proficiency: "beginner", type: "learning" }] }),
      ),
    ).toThrow(OnboardingRuleError);
  });

  it("throws when no interest", () => {
    expect(() =>
      OnboardingProgression.assertCanSubmit(snapshot({ interestCount: 0 })),
    ).toThrow(/incomplete/);
  });
});

describe("OnboardingProgression.assertNoNativeSpokenLearningConflict", () => {
  it("passes when no overlap", () => {
    expect(() =>
      OnboardingProgression.assertNoNativeSpokenLearningConflict({
        spoken: [{ language: "en", proficiency: "native" }],
        learning: [{ language: "nl" }],
      }),
    ).not.toThrow();
  });

  it("throws when a native-spoken language is also being learned", () => {
    expect(() =>
      OnboardingProgression.assertNoNativeSpokenLearningConflict({
        spoken: [{ language: "en", proficiency: "native" }],
        learning: [{ language: "en" }],
      }),
    ).toThrow(/native-spoken language\(s\) as learning: en/);
  });

  it("ignores non-native spoken proficiency", () => {
    expect(() =>
      OnboardingProgression.assertNoNativeSpokenLearningConflict({
        spoken: [{ language: "en", proficiency: "advanced" }],
        learning: [{ language: "en" }],
      }),
    ).not.toThrow();
  });
});
