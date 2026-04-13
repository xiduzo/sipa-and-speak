// Pure, side-effect-free helpers for the matching router.
// Exported separately so they can be unit-tested without importing the DB or env.

const MAX_RADIUS_KM = 50;

/** Haversine distance in km between two lat/lng points */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
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
 * Compose the push notification body for a MatchRequestSent event.
 * Includes language summary only when both offered and targeted languages are known.
 * Format: "{name} wants to meet you — speaks {offered}, learning {targeted}"
 */
export function buildMatchRequestNotificationBody(
  requesterName: string,
  offeredLanguage: string | null,
  targetedLanguage: string | null,
): string {
  if (offeredLanguage && targetedLanguage) {
    return `${requesterName} wants to meet you — speaks ${offeredLanguage}, learning ${targetedLanguage}`;
  }
  return `${requesterName} wants to meet you`;
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
