import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@sip-and-speak/db";
import {
  languageProfile,
  userLanguage,
  userInterest,
} from "@sip-and-speak/db/schema/sip-and-speak";
import { protectedProcedure, router } from "../index";

const interestEnum = z.enum([
  "modern_art",
  "tech_coding",
  "jazz_music",
  "culinary_arts",
  "sustainability",
  "cinephile",
  "cosmology",
]);

const proficiencyEnum = z.enum([
  "beginner",
  "intermediate",
  "advanced",
  "native",
]);

const spokenLanguageSchema = z.object({
  language: z.string(),
  proficiency: proficiencyEnum,
});

const learningLanguageSchema = z.object({
  language: z.string(),
});

const upsertProfileInput = z.object({
  bio: z.string().max(500).optional(),
  university: z.string().optional(),
  age: z.number().int().min(16).max(99).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  spokenLanguages: z.array(spokenLanguageSchema).min(1),
  learningLanguages: z.array(learningLanguageSchema).min(1),
  interests: z.array(interestEnum),
});

const partialProfileInput = z.object({
  bio: z.string().max(500).optional(),
  university: z.string().optional(),
  age: z.number().int().min(16).max(99).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  spokenLanguages: z.array(spokenLanguageSchema).optional(),
  learningLanguages: z.array(learningLanguageSchema).optional(),
  interests: z.array(interestEnum).optional(),
});

export const profileRouter = router({
  getMyProfile: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const profile = await db.query.languageProfile.findFirst({
      where: eq(languageProfile.userId, userId),
    });

    const languages = await db
      .select()
      .from(userLanguage)
      .where(eq(userLanguage.userId, userId));

    const interests = await db
      .select()
      .from(userInterest)
      .where(eq(userInterest.userId, userId));

    return {
      profile: profile ?? null,
      languages,
      interests,
    };
  }),

  upsertProfile: protectedProcedure
    .input(upsertProfileInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      await db.transaction(async (tx) => {
        // Upsert language profile
        const existing = await tx.query.languageProfile.findFirst({
          where: eq(languageProfile.userId, userId),
        });

        if (existing) {
          await tx
            .update(languageProfile)
            .set({
              bio: input.bio,
              university: input.university,
              age: input.age,
              latitude: input.latitude,
              longitude: input.longitude,
              onboardingComplete: true,
            })
            .where(eq(languageProfile.userId, userId));
        } else {
          await tx.insert(languageProfile).values({
            userId,
            bio: input.bio,
            university: input.university,
            age: input.age,
            latitude: input.latitude,
            longitude: input.longitude,
            onboardingComplete: true,
          });
        }

        // Replace languages
        await tx
          .delete(userLanguage)
          .where(eq(userLanguage.userId, userId));

        const languageRows = [
          ...input.spokenLanguages.map((l) => ({
            userId,
            language: l.language,
            type: "spoken" as const,
            proficiency: l.proficiency,
          })),
          ...input.learningLanguages.map((l) => ({
            userId,
            language: l.language,
            type: "learning" as const,
            proficiency: null,
          })),
        ];

        if (languageRows.length > 0) {
          await tx.insert(userLanguage).values(languageRows);
        }

        // Replace interests
        await tx
          .delete(userInterest)
          .where(eq(userInterest.userId, userId));

        if (input.interests.length > 0) {
          await tx.insert(userInterest).values(
            input.interests.map((interest) => ({
              userId,
              interest,
            })),
          );
        }
      });

      return { success: true };
    }),

  savePartialProfile: protectedProcedure
    .input(partialProfileInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      await db.transaction(async (tx) => {
        // Upsert language profile (without setting onboardingComplete)
        const existing = await tx.query.languageProfile.findFirst({
          where: eq(languageProfile.userId, userId),
        });

        const profileData: Record<string, unknown> = {};
        if (input.bio !== undefined) profileData.bio = input.bio;
        if (input.university !== undefined) profileData.university = input.university;
        if (input.age !== undefined) profileData.age = input.age;
        if (input.latitude !== undefined) profileData.latitude = input.latitude;
        if (input.longitude !== undefined) profileData.longitude = input.longitude;

        if (existing) {
          if (Object.keys(profileData).length > 0) {
            await tx
              .update(languageProfile)
              .set(profileData)
              .where(eq(languageProfile.userId, userId));
          }
        } else {
          await tx.insert(languageProfile).values({
            userId,
            ...profileData,
          });
        }

        // Replace languages if provided
        if (input.spokenLanguages || input.learningLanguages) {
          await tx
            .delete(userLanguage)
            .where(eq(userLanguage.userId, userId));

          const languageRows = [
            ...(input.spokenLanguages ?? []).map((l) => ({
              userId,
              language: l.language,
              type: "spoken" as const,
              proficiency: l.proficiency,
            })),
            ...(input.learningLanguages ?? []).map((l) => ({
              userId,
              language: l.language,
              type: "learning" as const,
              proficiency: null,
            })),
          ];

          if (languageRows.length > 0) {
            await tx.insert(userLanguage).values(languageRows);
          }
        }

        // Replace interests if provided
        if (input.interests) {
          await tx
            .delete(userInterest)
            .where(eq(userInterest.userId, userId));

          if (input.interests.length > 0) {
            await tx.insert(userInterest).values(
              input.interests.map((interest) => ({
                userId,
                interest,
              })),
            );
          }
        }
      });

      return { success: true };
    }),

  getOnboardingStatus: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const profile = await db.query.languageProfile.findFirst({
      where: eq(languageProfile.userId, userId),
      columns: { onboardingComplete: true },
    });

    return { complete: profile?.onboardingComplete ?? false };
  }),
});
