// Pure scoring helpers — no DB or env imports so they can be unit-tested directly.

export const MAX_RADIUS_KM = 50;

/** Hard cap on suggestion list results. */
export const SUGGESTION_LIST_LIMIT = 10;

/**
 * Sort candidates by score descending and return at most `limit` items.
 * Exported for unit testing.
 */
export function applySuggestionCap<T extends { score: number }>(
  candidates: T[],
  limit: number = SUGGESTION_LIST_LIMIT,
): T[] {
  return [...candidates].sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Exclude candidates that have already received a match request from the user.
 * Exported for unit testing.
 */
export function excludeRequestedCandidates<T extends { userId: string }>(
  candidates: T[],
  requestedIds: Set<string>,
): T[] {
  return candidates.filter((c) => !requestedIds.has(c.userId));
}

/** Haversine distance in km between two lat/lng points */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Language complementarity score.
 * 1.0 — partner speaks a language user wants to learn AND partner wants to learn a language user speaks.
 * 0.5 — only one direction matches.
 * 0   — no complementarity.
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

  if (partnerSpeaksWhatUserLearns && partnerLearnsWhatUserSpeaks) return 1.0;
  if (partnerSpeaksWhatUserLearns || partnerLearnsWhatUserSpeaks) return 0.5;
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

const BRIDGE_OFFERED_LANGUAGE = "Dutch";
const BRIDGE_TARGET_LANGUAGES = ["Dutch", "English"];

/**
 * Dutch/English bridge rule eligibility.
 * A candidate qualifies if they offer Dutch AND target at least one of Dutch or English.
 * Supports the platform launch context where Dutch/English are primary lingua francas.
 */
export function computeBridgeRuleEligibility(
  candidateSpoken: string[],
  candidateLearning: string[],
): boolean {
  const offersDutch = candidateSpoken.includes(BRIDGE_OFFERED_LANGUAGE);
  const targetsBridgeLanguage = candidateLearning.some((lang) =>
    BRIDGE_TARGET_LANGUAGES.includes(lang),
  );
  return offersDutch && targetsBridgeLanguage;
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
