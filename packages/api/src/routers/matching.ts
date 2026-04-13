import { and, eq, ne, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@sip-and-speak/db";
import {
  languageProfile,
  userLanguage,
  userInterest,
  matchRequest,
} from "@sip-and-speak/db/schema/sip-and-speak";
import { user } from "@sip-and-speak/db/schema/auth";
import { protectedProcedure, router } from "../index";
import { domainEvents } from "../domain-events";

// --- Scoring helpers (exported for testing) ---

const MAX_RADIUS_KM = 50;

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

// --- Router ---

export const matchingRouter = router({
  discover: protectedProcedure
    .input(
      z.object({
        filter: z.enum(["near_you", "language"]).optional(),
        filterLanguage: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Fetch current user's profile, languages, and interests
      const myProfile = await db.query.languageProfile.findFirst({
        where: eq(languageProfile.userId, userId),
      });

      const myLanguages = await db
        .select()
        .from(userLanguage)
        .where(eq(userLanguage.userId, userId));

      const myInterests = await db
        .select()
        .from(userInterest)
        .where(eq(userInterest.userId, userId));

      const mySpoken = myLanguages
        .filter((l) => l.type === "spoken")
        .map((l) => l.language);
      const myLearning = myLanguages
        .filter((l) => l.type === "learning")
        .map((l) => l.language);
      const myInterestNames = myInterests.map((i) => i.interest);

      // Fetch all other users who have completed onboarding
      const otherProfiles = await db
        .select()
        .from(languageProfile)
        .where(
          and(
            ne(languageProfile.userId, userId),
            eq(languageProfile.onboardingComplete, true),
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

      // Fetch user info (name, image) for candidates
      const allUsers = await db
        .select({ id: user.id, name: user.name, image: user.image })
        .from(user)
        .where(inArray(user.id, otherUserIds));

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

      // Score each candidate
      type ScoredPartner = {
        userId: string;
        name: string;
        image: string | null;
        bio: string | null;
        university: string | null;
        age: number | null;
        distance: number | null;
        spokenLanguages: { language: string; proficiency: string | null }[];
        learningLanguages: string[];
        interests: string[];
        score: number;
      };

      const scored: ScoredPartner[] = [];

      for (const profile of otherProfiles) {
        const langs = langByUser.get(profile.userId) ?? [];
        const interests = interestByUser.get(profile.userId) ?? [];
        const userInfo = userMap.get(profile.userId);

        const partnerSpoken = langs
          .filter((l) => l.type === "spoken")
          .map((l) => l.language);
        const partnerLearning = langs
          .filter((l) => l.type === "learning")
          .map((l) => l.language);
        const partnerInterests = interests.map((i) => i.interest);

        // Language filter: skip if partner doesn't speak the requested language
        if (input.filter === "language" && input.filterLanguage) {
          if (!partnerSpoken.includes(input.filterLanguage)) continue;
        }

        const langScore = computeLanguageScore(
          mySpoken,
          myLearning,
          partnerSpoken,
          partnerLearning,
        );
        const intScore = computeInterestScore(myInterestNames, partnerInterests);

        let distanceKm: number | null = null;
        let proxScore = 0;
        if (
          myProfile?.latitude != null &&
          myProfile?.longitude != null &&
          profile.latitude != null &&
          profile.longitude != null
        ) {
          distanceKm = haversineDistance(
            myProfile.latitude,
            myProfile.longitude,
            profile.latitude,
            profile.longitude,
          );
          proxScore = computeProximityScore(distanceKm);
        }

        const score = computeCompositeScore(
          langScore,
          intScore,
          proxScore,
          input.filter,
        );

        scored.push({
          userId: profile.userId,
          name: userInfo?.name ?? "Unknown",
          image: userInfo?.image ?? null,
          bio: profile.bio,
          university: profile.university,
          age: profile.age,
          distance: distanceKm != null ? Math.round(distanceKm * 10) / 10 : null,
          spokenLanguages: langs
            .filter((l) => l.type === "spoken")
            .map((l) => ({ language: l.language, proficiency: l.proficiency })),
          learningLanguages: partnerLearning,
          interests: partnerInterests,
          score,
        });
      }

      // Sort by score descending
      scored.sort((a, b) => b.score - a.score);

      // Cursor-based pagination (cursor = index offset as string)
      const startIndex = input.cursor ? parseInt(input.cursor, 10) : 0;
      const page = scored.slice(startIndex, startIndex + input.limit);
      const nextCursor =
        startIndex + input.limit < scored.length
          ? String(startIndex + input.limit)
          : undefined;

      return { partners: page, nextCursor };
    }),

  getPartnerProfile: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const profile = await db.query.languageProfile.findFirst({
        where: eq(languageProfile.userId, input.userId),
      });

      if (!profile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This profile is no longer available.",
        });
      }

      const languages = await db
        .select()
        .from(userLanguage)
        .where(eq(userLanguage.userId, input.userId));

      const interests = await db
        .select()
        .from(userInterest)
        .where(eq(userInterest.userId, input.userId));

      const userInfo = await db
        .select({ id: user.id, name: user.name, image: user.image, email: user.email })
        .from(user)
        .where(eq(user.id, input.userId))
        .then((rows) => rows[0] ?? null);

      return {
        userId: profile.userId,
        name: userInfo?.name ?? "Unknown",
        image: userInfo?.image ?? null,
        bio: profile.bio,
        university: profile.university,
        age: profile.age,
        latitude: profile.latitude,
        longitude: profile.longitude,
        spokenLanguages: languages
          .filter((l) => l.type === "spoken")
          .map((l) => ({ language: l.language, proficiency: l.proficiency })),
        learningLanguages: languages
          .filter((l) => l.type === "learning")
          .map((l) => l.language),
        interests: interests.map((i) => i.interest),
        onboardingComplete: profile.onboardingComplete,
      };
    }),

  getMatchRequestStatus: protectedProcedure
    .input(z.object({ candidateUserId: z.string() }))
    .query(async ({ ctx, input }) => {
      const requesterId = ctx.session.user.id;
      const existing = await db.query.matchRequest.findFirst({
        where: and(
          eq(matchRequest.requesterId, requesterId),
          eq(matchRequest.receiverId, input.candidateUserId),
        ),
      });
      const status = existing?.status;
      const matchRequestStatus =
        status === "pending" || status === "accepted" || status === "declined"
          ? status
          : ("none" as const);
      return { matchRequestStatus };
    }),

  sendMatchRequest: protectedProcedure
    .input(z.object({ receiverId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const requesterId = ctx.session.user.id;

      if (requesterId === input.receiverId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot send a match request to yourself.",
        });
      }

      // Check receiver exists
      const receiverProfile = await db.query.languageProfile.findFirst({
        where: eq(languageProfile.userId, input.receiverId),
      });
      if (!receiverProfile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This profile is no longer available.",
        });
      }

      // Check for existing active request (dedup at app level)
      const existing = await db.query.matchRequest.findFirst({
        where: and(
          eq(matchRequest.requesterId, requesterId),
          eq(matchRequest.receiverId, input.receiverId),
        ),
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A match request to this candidate already exists.",
        });
      }

      const rows = await db
        .insert(matchRequest)
        .values({
          requesterId,
          receiverId: input.receiverId,
          status: "pending",
        })
        .returning({ id: matchRequest.id });

      const created = rows[0];
      if (!created) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create match request." });
      }

      console.info("[MatchRequestSent]", {
        matchRequestId: created.id,
        requesterId,
        receiverId: input.receiverId,
      });

      domainEvents.emit("MatchRequestSent", {
        matchRequestId: created.id,
        requesterId,
        receiverId: input.receiverId,
        sentAt: new Date(),
      });

      return { matchRequestId: created.id, status: "pending" as const };
    }),
});
