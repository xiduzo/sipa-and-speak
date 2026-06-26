import {
  ONBOARDING_INTEREST_MIN,
  validateOnboardingStep,
  isOnboardingStepComplete,
  type OnboardingCounts,
} from "@/utils/onboarding-flow";

const counts = (over: Partial<OnboardingCounts> = {}): OnboardingCounts => ({
  spoken: 1,
  learning: 1,
  interests: ONBOARDING_INTEREST_MIN,
  ...over,
});

describe("validateOnboardingStep", () => {
  it("step 3 requires at least one spoken language", () => {
    expect(validateOnboardingStep(3, counts({ spoken: 0 }))).toEqual({
      ok: false,
      error: "Add at least one language you speak.",
    });
    expect(validateOnboardingStep(3, counts({ spoken: 1 }))).toEqual({ ok: true });
  });

  it("step 4 requires at least one learning language", () => {
    expect(validateOnboardingStep(4, counts({ learning: 0 }))).toEqual({
      ok: false,
      error: "Add at least one language to learn.",
    });
    expect(validateOnboardingStep(4, counts({ learning: 1 }))).toEqual({ ok: true });
  });

  it(`step 5 requires at least ${ONBOARDING_INTEREST_MIN} interests`, () => {
    expect(validateOnboardingStep(5, counts({ interests: ONBOARDING_INTEREST_MIN - 1 }))).toEqual({
      ok: false,
      error: `Pick at least ${ONBOARDING_INTEREST_MIN} topics.`,
    });
    expect(validateOnboardingStep(5, counts({ interests: ONBOARDING_INTEREST_MIN }))).toEqual({
      ok: true,
    });
  });

  it("step 5 stays valid above the minimum (the max is UX guidance, not a hard gate)", () => {
    expect(validateOnboardingStep(5, counts({ interests: 10 }))).toEqual({ ok: true });
  });
});

describe("isOnboardingStepComplete", () => {
  it("mirrors validateOnboardingStep's ok flag", () => {
    expect(isOnboardingStepComplete(3, counts({ spoken: 0 }))).toBe(false);
    expect(isOnboardingStepComplete(5, counts({ interests: ONBOARDING_INTEREST_MIN }))).toBe(true);
  });
});
