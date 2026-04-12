import { and, eq, ne, inArray } from "drizzle-orm";
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
import {
  haversineDistance,
  computeLanguageScore,
  computeInterestScore,
  computeProximityScore,
  computeCompositeScore,
  computeBridgeRuleEligibility,
  applySuggestionCap,
  excludeRequestedCandidates,
  MAX_RADIUS_KM,
  SUGGESTION_LIST_LIMIT,
} from "./matching.scoring";

export {
  haversineDistance,
  computeLanguageScore,
  computeInterestScore,
  computeProximityScore,
  computeCompositeScore,
  computeBridgeRuleEligibility,
  applySuggestionCap,
  excludeRequestedCandidates,
  MAX_RADIUS_KM,
  SUGGESTION_LIST_LIMIT,
};

// --- Router ---

export const matchingRouter = router({
  discover: protectedProcedure
    .input(
      z.object({
        filter: z.enum(["near_you", "language"]).optional(),
        filterLanguage: z.string().optional(),
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

      // Fetch candidates the Student has already sent a match request to
      const sentRequests = await db
        .select({ receiverId: matchRequest.receiverId })
        .from(matchRequest)
        .where(eq(matchRequest.requesterId, userId));
      const requestedIds = new Set(sentRequests.map((r) => r.receiverId));

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
        return [];
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

      type ScoredPartner = {
        userId: string;
        name: string;
        photoUrl: string | null;
        offeredLanguages: string[];
        targetedLanguages: string[];
        conversationTopics: string[];
        score: number;
      };

      const scored: ScoredPartner[] = [];

      for (const profile of otherProfiles) {
        // Exclude candidates already requested
        if (requestedIds.has(profile.userId)) continue;

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
        const bridgeEligible = computeBridgeRuleEligibility(
          partnerSpoken,
          partnerLearning,
        );

        // Skip candidates that pass neither language rule nor bridge rule
        if (langScore === 0 && !bridgeEligible) continue;

        const intScore = computeInterestScore(myInterestNames, partnerInterests);

        let proxScore = 0;
        if (
          myProfile?.latitude != null &&
          myProfile?.longitude != null &&
          profile.latitude != null &&
          profile.longitude != null
        ) {
          const distanceKm = haversineDistance(
            myProfile.latitude,
            myProfile.longitude,
            profile.latitude,
            profile.longitude,
          );
          proxScore = computeProximityScore(distanceKm);
        }

        // Bridge-only candidates get a base language score of 0.5 so they rank alongside partial matches
        const effectiveLangScore = langScore > 0 ? langScore : 0.5;
        const score = computeCompositeScore(
          effectiveLangScore,
          intScore,
          proxScore,
          input.filter,
        );

        scored.push({
          userId: profile.userId,
          name: userInfo?.name ?? "Unknown",
          photoUrl: userInfo?.image ?? null,
          offeredLanguages: partnerSpoken,
          targetedLanguages: partnerLearning,
          conversationTopics: partnerInterests,
          score,
        });
      }

      // Sort by score descending, then hard-cap at 10
      scored.sort((a, b) => b.score - a.score);
      const suggestions = scored.slice(0, SUGGESTION_LIST_LIMIT);

      // Emit domain event (fire-and-forget)
      domainEvents.emit("SuggestionListRequested", {
        userId,
        resultCount: suggestions.length,
        requestedAt: new Date(),
      });

      return suggestions;
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
