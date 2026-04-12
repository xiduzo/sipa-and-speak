import { and, eq, ne, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@sip-and-speak/db";
import {
  languageProfile,
  userLanguage,
  userInterest,
} from "@sip-and-speak/db/schema/sip-and-speak";
import { user } from "@sip-and-speak/db/schema/auth";
import { protectedProcedure, router } from "../index";
import {
  haversineDistance,
  computeLanguageScore,
  computeInterestScore,
  computeProximityScore,
  computeCompositeScore,
  MAX_RADIUS_KM,
} from "./matching.scoring";

export {
  haversineDistance,
  computeLanguageScore,
  computeInterestScore,
  computeProximityScore,
  computeCompositeScore,
  MAX_RADIUS_KM,
};

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
        return null;
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
});
