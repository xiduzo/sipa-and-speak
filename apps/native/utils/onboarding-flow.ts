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

// ── shared wizard constants ──────────────────────────────────────────────────
// Single source for the vocabulary both wizard surfaces (the standalone
// onboarding screen and the overlay OnboardingModal) render. Interest labels
// live in `interest-labels.ts`, flags in `language-flags.ts`.

export type LearningProficiency = "beginner" | "intermediate" | "advanced";

/** A language selection in the wizard (spoken or learning). */
export type OnboardingLanguage = { language: string; proficiency: LearningProficiency };

/** CEFR proficiency blocks rendered under each selected language. */
export const LEVEL_BLOCKS: { value: LearningProficiency; label: string; sub: string }[] = [
  { value: "beginner", label: "A1–A2", sub: "Beginner" },
  { value: "intermediate", label: "B1–B2", sub: "Intermediate" },
  { value: "advanced", label: "C1–C2", sub: "Advanced" },
];

export const ONBOARDING_STEP_TITLES = [
  "How should\npeople greet you?",
  "Add a face\nto your name.",
  "What do\nyou speak?",
  "What are\nyou learning?",
  "Which topics do\nyou want to practice?",
];

export const ONBOARDING_STEP_SUBTITLES = [
  "Pulled from TU/e. Change if you go by something else.",
  "So your buddy can spot you across the café.",
  "Languages you can hold a conversation in.",
  "We'll pair you with native speakers.",
  `Pick ${ONBOARDING_INTEREST_MIN}–${ONBOARDING_INTEREST_MAX}. Seeds your first match.`,
];
