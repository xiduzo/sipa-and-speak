// Pure, side-effect-free helpers for the matching router.
// Exported separately so they can be unit-tested without importing the DB or env.

/**
 * Language complementarity score. Both students must benefit.
 * 1.0 — mutual teach/learn (partner speaks what user learns AND partner learns what user speaks),
 *       OR both want to practice a common language.
 * 0   — one-directional or no overlap.
 */
export function computeLanguageScore(
  userSpoken: string[],
  userLearning: string[],
  partnerSpoken: string[],
  partnerLearning: string[],
): number {
  const partnerSpeaksWhatUserLearns = userLearning.some((lang) =>
    partnerSpoken.includes(lang),
  );
  const partnerLearnsWhatUserSpeaks = partnerLearning.some((lang) =>
    userSpoken.includes(lang),
  );
  const sharedLearningLanguage = userLearning.some((lang) =>
    partnerLearning.includes(lang),
  );

  if (partnerSpeaksWhatUserLearns && partnerLearnsWhatUserSpeaks) return 1.0;
  if (sharedLearningLanguage) return 1.0;
  return 0;
}

/**
 * Extract excluded user IDs from active match requests involving the given user.
 * Bidirectional: a candidate who sent a request to the user is also excluded.
 */
export function buildExcludedUserIds(
  userId: string,
  activeRequests: { requesterId: string; receiverId: string }[],
): string[] {
  return activeRequests.map((r) =>
    r.requesterId === userId ? r.receiverId : r.requesterId,
  );
}

export type CandidateProfile = {
  userId: string;
  name: string;
  image: string | null;
  bio: string | null;
  university: string | null;
  age: number | null;
  spokenLanguages: { language: string; proficiency: string | null }[];
  learningLanguages: string[];
  interests: string[];
};

export type ScoredCandidate = CandidateProfile & {
  score: number;
};

type UserForScoring = {
  spoken: string[];
  learning: string[];
};

/**
 * Score and rank candidates against the requesting user.
 * Score is based on language complementarity only.
 * Optional language filter restricts candidates to those who speak the given language.
 * Pure: no DB access, no side effects.
 */
export function scoreCandidates(
  me: UserForScoring,
  candidates: CandidateProfile[],
  filter?: { language: string },
): ScoredCandidate[] {
  const scored: ScoredCandidate[] = [];

  for (const candidate of candidates) {
    if (filter?.language) {
      if (!candidate.spokenLanguages.some((l) => l.language === filter.language)) continue;
    }

    const partnerSpoken = candidate.spokenLanguages.map((l) => l.language);
    const score = computeLanguageScore(
      me.spoken,
      me.learning,
      partnerSpoken,
      candidate.learningLanguages,
    );

    if (score === 0) continue;

    scored.push({ ...candidate, score });
  }

  return scored;
}
