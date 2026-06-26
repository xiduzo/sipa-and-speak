/**
 * Onboarding wizard flow rules — the pure view-model logic behind
 * `OnboardingModal`. The component owns React state and JSX; the *rules* for
 * when a step may advance, and what error to show when it can't, live here so
 * they are stated once and testable without rendering the modal.
 *
 * These are the wizard's own gates. They are deliberately STRICTER than the
 * server's matching-eligibility rule (≥1 spoken, ≥1 learning, ≥1 interest,
 * owned by `OnboardingProgression`): onboarding asks for 3–7 interests to seed
 * a good first match. The server stays the source of truth for whether a
 * profile is matchable; this module only governs the wizard UX.
 */

/** Interest-count bounds for the onboarding wizard ("Pick 3–7"). */
export const ONBOARDING_INTEREST_MIN = 3;
export const ONBOARDING_INTEREST_MAX = 7;

/** The wizard steps that carry an advance-gate (1–2 are identity, gated separately). */
export type GatedStep = 3 | 4 | 5;

export type OnboardingCounts = {
  spoken: number;
  learning: number;
  interests: number;
};

export type StepValidation = { ok: true } | { ok: false; error: string };

/**
 * Whether the wizard may advance from `step`, and the error to surface if not.
 * Single source of truth for the per-step gates that were inlined across
 * `handleStep3Continue` / `handleStep4Continue` / `handleFinish`.
 */
export function validateOnboardingStep(
  step: GatedStep,
  counts: OnboardingCounts,
): StepValidation {
  switch (step) {
    case 3:
      return counts.spoken > 0
        ? { ok: true }
        : { ok: false, error: "Add at least one language you speak." };
    case 4:
      return counts.learning > 0
        ? { ok: true }
        : { ok: false, error: "Add at least one language to learn." };
    case 5:
      return counts.interests >= ONBOARDING_INTEREST_MIN
        ? { ok: true }
        : { ok: false, error: `Pick at least ${ONBOARDING_INTEREST_MIN} topics.` };
  }
}

/** Convenience for the CTA `disabled` props — true when the step's gate is satisfied. */
export function isOnboardingStepComplete(step: GatedStep, counts: OnboardingCounts): boolean {
  return validateOnboardingStep(step, counts).ok;
}
