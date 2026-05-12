// Pure, side-effect-free helpers for the matching router.
// Exported separately so they can be unit-tested without importing the DB or env.

import { haversineDistance } from "../../lib/geo";

const MAX_RADIUS_KM = 50;

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
 * Interest overlap score: sharedInterests / max(userInterests, partnerInterests).
 * Returns 0 when both lists are empty.
 */
export function computeInterestScore(
  userInterests: string[],
  partnerInterests: string[],
): number {
  const maxLen = Math.max(userInterests.length, partnerInterests.length);
  if (maxLen === 0) return 0;
  const shared = userInterests.filter((i) => partnerInterests.includes(i));
  return shared.length / maxLen;
}

/**
 * Proximity score: 1 - min(distance / maxRadius, 1).
 * Closer = higher score.
 */
export function computeProximityScore(
  distanceKm: number,
  maxRadius: number = MAX_RADIUS_KM,
): number {
  return 1 - Math.min(distanceKm / maxRadius, 1);
}

/**
 * Composite matching score.
 * Default weights: language 0.5, interest 0.3, proximity 0.2.
 * "near_you" filter boosts proximity: language 0.3, interest 0.2, proximity 0.5.
 */
export function computeCompositeScore(
  languageScore: number,
  interestScore: number,
  proximityScore: number,
  filter?: "near_you" | "language",
): number {
  if (filter === "near_you") {
    return languageScore * 0.3 + interestScore * 0.2 + proximityScore * 0.5;
  }
  return languageScore * 0.5 + interestScore * 0.3 + proximityScore * 0.2;
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
  latitude: number | null;
  longitude: number | null;
  spokenLanguages: { language: string; proficiency: string | null }[];
  learningLanguages: string[];
  interests: string[];
};

export type ScoredCandidate = CandidateProfile & {
  distance: number | null;
  score: number;
};

type UserForScoring = {
  spoken: string[];
  learning: string[];
  interests: string[];
  latitude: number | null;
  longitude: number | null;
};

/**
 * Score and rank candidates against the requesting user.
 * Applies the language filter (when mode === "language"), computes per-dimension
 * scores, and returns candidates sorted by composite score descending.
 * Pure: no DB access, no side effects.
 */
export function scoreCandidates(
  me: UserForScoring,
  candidates: CandidateProfile[],
  filter?: { mode: "near_you" | "language"; language?: string },
): ScoredCandidate[] {
  const scored: ScoredCandidate[] = [];

  for (const candidate of candidates) {
    if (filter?.mode === "language" && filter.language) {
      if (!candidate.spokenLanguages.some((l) => l.language === filter.language)) continue;
    }

    const partnerSpoken = candidate.spokenLanguages.map((l) => l.language);
    const langScore = computeLanguageScore(
      me.spoken,
      me.learning,
      partnerSpoken,
      candidate.learningLanguages,
    );

    if (langScore === 0) continue;

    const intScore = computeInterestScore(me.interests, candidate.interests);

    let distanceKm: number | null = null;
    let proxScore = 0;
    if (
      me.latitude != null &&
      me.longitude != null &&
      candidate.latitude != null &&
      candidate.longitude != null
    ) {
      distanceKm = haversineDistance(me.latitude, me.longitude, candidate.latitude, candidate.longitude);
      proxScore = computeProximityScore(distanceKm);
    }

    scored.push({
      ...candidate,
      distance: distanceKm != null ? Math.round(distanceKm * 10) / 10 : null,
      score: computeCompositeScore(langScore, intScore, proxScore, filter?.mode),
    });
  }

  return scored.sort((a, b) => b.score - a.score);
}
