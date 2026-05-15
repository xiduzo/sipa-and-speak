/**
 * OnboardingProgression — pure derivation of where a Student sits in the
 * Identity & Onboarding flow, plus the predicates that gate transitions.
 *
 * Data sources (passed in as a snapshot — the aggregate owns no I/O):
 *   - identity row (`user.name`, `user.surname`)
 *   - userLanguage rows split by type (`spoken` / `learning`)
 *   - userInterest rows
 *
 * Phases:
 *   - Registering  — identity name/surname missing
 *   - IdentitySet  — identity present; profile data still incomplete
 *   - Submitted    — matching-eligible (≥1 spoken, ≥1 learning, ≥1 interest)
 *
 * The router persists the `languageProfile.onboardingComplete` flag based on
 * `matchingEligible` (auto-sync) or explicitly via `submitProfile`.
 */

export type OnboardingPhase = "Registering" | "IdentitySet" | "Submitted";

export type MissingField = "name" | "surname" | "spoken" | "learning" | "interest";

export type LanguageEntry = { language: string; proficiency?: string; type: "spoken" | "learning" };

export type OnboardingSnapshot = {
  identity: { name: string | null; surname: string | null };
  languages: LanguageEntry[];
  interestCount: number;
};

export type OnboardingState = {
  phase: OnboardingPhase;
  identityComplete: boolean;
  matchingEligible: boolean;
  missingFields: MissingField[];
};

export class OnboardingRuleError extends Error {
  constructor(public code: "BAD_REQUEST", message: string) {
    super(message);
    this.name = "OnboardingRuleError";
  }
}

function trimmed(s: string | null | undefined): string {
  return (s ?? "").trim();
}

export const OnboardingProgression = {
  /** Derive the full onboarding state from a snapshot. Pure. */
  evaluate(snapshot: OnboardingSnapshot): OnboardingState {
    const name = trimmed(snapshot.identity.name);
    const surname = trimmed(snapshot.identity.surname);
    const identityComplete = name.length > 0 && surname.length > 0;

    const hasSpoken = snapshot.languages.some((l) => l.type === "spoken");
    const hasLearning = snapshot.languages.some((l) => l.type === "learning");
    const hasInterest = snapshot.interestCount > 0;

    const matchingEligible = identityComplete && hasSpoken && hasLearning && hasInterest;

    const missingFields: MissingField[] = [];
    if (!name) missingFields.push("name");
    if (!surname) missingFields.push("surname");
    if (!hasSpoken) missingFields.push("spoken");
    if (!hasLearning) missingFields.push("learning");
    if (!hasInterest) missingFields.push("interest");

    let phase: OnboardingPhase;
    if (!identityComplete) phase = "Registering";
    else if (!matchingEligible) phase = "IdentitySet";
    else phase = "Submitted";

    return { phase, identityComplete, matchingEligible, missingFields };
  },

  /**
   * Submit guard: throws if the snapshot is not yet matching-eligible.
   * Identity completeness is intentionally not checked here — `submitProfile`
   * only ever required the language/interest triple, and we preserve that
   * boundary to avoid changing the existing client-facing behaviour.
   */
  assertCanSubmit(snapshot: OnboardingSnapshot): void {
    const hasSpoken = snapshot.languages.some((l) => l.type === "spoken");
    const hasLearning = snapshot.languages.some((l) => l.type === "learning");
    const hasInterest = snapshot.interestCount > 0;
    if (!hasSpoken || !hasLearning || !hasInterest) {
      throw new OnboardingRuleError(
        "BAD_REQUEST",
        "Profile is incomplete. Add at least one spoken language, one learning language, and one interest.",
      );
    }
  },

  /**
   * Reject any learning language that the Student also speaks natively.
   * Throws on conflict; returns silently otherwise.
   */
  assertNoNativeSpokenLearningConflict(args: {
    spoken: Array<{ language: string; proficiency: string }>;
    learning: Array<{ language: string }>;
  }): void {
    const nativeSpeakerSet = new Set(
      args.spoken.filter((l) => l.proficiency === "native").map((l) => l.language),
    );
    const conflicts = args.learning
      .filter((l) => nativeSpeakerSet.has(l.language))
      .map((l) => l.language);
    if (conflicts.length > 0) {
      throw new OnboardingRuleError(
        "BAD_REQUEST",
        `Cannot add native-spoken language(s) as learning: ${conflicts.join(", ")}`,
      );
    }
  },
};
