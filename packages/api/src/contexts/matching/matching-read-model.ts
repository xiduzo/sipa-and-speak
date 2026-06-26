/**
 * Matching read model — the query side of the Matching context.
 *
 * The MatchRequest aggregate owns transitions (the write side). This module owns
 * the read side of partner discovery: the candidate queries, the per-user
 * grouping of languages and interests, candidate assembly, staging into the pure
 * `scoreCandidates` ranker, and cursor pagination — everything the `discover`
 * procedure used to inline.
 *
 * Pulling these out of the router gives the ranking a small interface (`userId`
 * + limit/cursor/filter) over a large implementation (exclusion-list
 * construction, onboarding/suspension/deleted-account filtering, batch fetches,
 * grouping maps, and compatible-language derivation) — and makes it testable
 * through the harness without driving the full tRPC procedure.
 */
import { and, eq, ne, inArray, notInArray, or, isNull } from "drizzle-orm";
import { db } from "@sip-and-speak/db";
import { languageProfile, userLanguage, userInterest } from "@sip-and-speak/db/schema/identity";
import { matchRequest } from "@sip-and-speak/db/schema/matching";
import { user } from "@sip-and-speak/db/schema/auth";
import { buildExcludedUserIds, scoreCandidates } from "./matching-utils";

export type DiscoverOptions = {
  filterLanguage?: string;
  cursor?: string;
  limit: number;
};

/**
 * Discoverable partners for the user, ranked by language complementarity and
 * paginated. Excludes pairs with an active request in either direction (#125),
 * candidates who haven't completed onboarding, suspended/removed Students
 * (#100/#108), and soft-deleted accounts (#447). Each returned partner carries
 * the languages compatible with the user for the discover card.
 */
export async function getRankedCandidates(
  userId: string,
  { filterLanguage, cursor, limit }: DiscoverOptions,
) {
  const myLanguages = await db
    .select()
    .from(userLanguage)
    .where(eq(userLanguage.userId, userId));

  const mySpoken = myLanguages
    .filter((l) => l.type === "spoken")
    .map((l) => l.language);
  const myLearning = myLanguages
    .filter((l) => l.type === "learning")
    .map((l) => l.language);

  // #125 — Build exclusion list: candidates with an active request in either direction
  const activeRequests = await db
    .select({
      requesterId: matchRequest.requesterId,
      receiverId: matchRequest.receiverId,
    })
    .from(matchRequest)
    .where(
      and(
        or(
          eq(matchRequest.requesterId, userId),
          eq(matchRequest.receiverId, userId),
        ),
        // "voided" = an unmatch (#7) — keep that pair out of discover for good.
        inArray(matchRequest.status, ["pending", "accepted", "voided"]),
      ),
    );

  const excludedUserIds = buildExcludedUserIds(userId, activeRequests);

  // Fetch all other users who have completed onboarding
  const otherProfiles = await db
    .select()
    .from(languageProfile)
    .where(
      and(
        ne(languageProfile.userId, userId),
        eq(languageProfile.onboardingComplete, true),
        excludedUserIds.length > 0
          ? notInArray(languageProfile.userId, excludedUserIds)
          : undefined,
      ),
    );

  if (otherProfiles.length === 0) {
    return { partners: [], nextCursor: undefined };
  }

  const otherUserIds = otherProfiles.map((p) => p.userId);

  // Batch-fetch languages and interests for all candidates
  const allLanguages = await db
    .select()
    .from(userLanguage)
    .where(inArray(userLanguage.userId, otherUserIds));

  const allInterests = await db
    .select()
    .from(userInterest)
    .where(inArray(userInterest.userId, otherUserIds));

  // Fetch user info (name, image) for candidates — exclude suspended AND
  // permanently removed Students (#100/#108) and soft-deleted accounts (#447)
  const allUsers = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(
      and(
        inArray(user.id, otherUserIds),
        notInArray(user.studentStatus, ["suspended", "removed"]),
        isNull(user.deletedAt),
      ),
    );

  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  // Group languages and interests by userId
  const langByUser = new Map<string, typeof allLanguages>();
  for (const l of allLanguages) {
    const arr = langByUser.get(l.userId) ?? [];
    arr.push(l);
    langByUser.set(l.userId, arr);
  }

  const interestByUser = new Map<string, typeof allInterests>();
  for (const i of allInterests) {
    const arr = interestByUser.get(i.userId) ?? [];
    arr.push(i);
    interestByUser.set(i.userId, arr);
  }

  // Build candidate list (suspended users absent from userMap are excluded)
  const candidates = otherProfiles
    .filter((profile) => userMap.has(profile.userId))
    .map((profile) => {
      const langs = langByUser.get(profile.userId) ?? [];
      const interests = interestByUser.get(profile.userId) ?? [];
      const userInfo = userMap.get(profile.userId)!;
      return {
        userId: profile.userId,
        name: userInfo.name ?? "Unknown",
        image: userInfo.image ?? null,
        bio: profile.bio,
        university: profile.university,
        age: profile.age,
        spokenLanguages: langs
          .filter((l) => l.type === "spoken")
          .map((l) => ({ language: l.language, proficiency: l.proficiency })),
        learningLanguages: langs
          .filter((l) => l.type === "learning")
          .map((l) => l.language),
        interests: interests.map((i) => i.interest),
      };
    });

  const scored = scoreCandidates(
    { spoken: mySpoken, learning: myLearning },
    candidates,
    filterLanguage ? { language: filterLanguage } : undefined,
  );

  // Cursor-based pagination (cursor = index offset as string)
  const startIndex = cursor ? parseInt(cursor, 10) : 0;
  const page = scored.slice(startIndex, startIndex + limit).map((candidate) => {
    const partnerSpoken = candidate.spokenLanguages.map((l) => l.language);
    const compatibleLanguages = Array.from(new Set([
      ...myLearning.filter((lang) => partnerSpoken.includes(lang)),
      ...mySpoken.filter((lang) => candidate.learningLanguages.includes(lang)),
      ...myLearning.filter((lang) => candidate.learningLanguages.includes(lang)),
    ]));
    return { ...candidate, compatibleLanguages };
  });
  const nextCursor =
    startIndex + limit < scored.length
      ? String(startIndex + limit)
      : undefined;

  return { partners: page, nextCursor };
}
