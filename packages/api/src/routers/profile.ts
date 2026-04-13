import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@sip-and-speak/db";
import {
  languageProfile,
  userLanguage,
  userInterest,
  studentComment,
  userDeviceToken,
} from "@sip-and-speak/db/schema/sip-and-speak";
import { user } from "@sip-and-speak/db/schema/auth";
import { protectedProcedure, router } from "../index";
import { domainEvents } from "../domain-events";

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

const learningProficiencyEnum = z.enum(["beginner", "intermediate", "advanced"]);

const learningLanguageSchema = z.object({
  language: z.string(),
  proficiency: learningProficiencyEnum.optional(),
});

const upsertProfileInput = z.object({
  bio: z.string().max(500).optional(),
  university: z.string().optional(),
  age: z.number().int().min(16).max(99).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  spokenLanguages: z.array(spokenLanguageSchema).min(1),
  learningLanguages: z.array(learningLanguageSchema).min(1),
  interests: z.array(interestEnum).min(1, "Select at least one interest"),
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

function assertNoNativeSpokenLearningConflict(
  spokenLanguages: { language: string; proficiency: string }[],
  learningLanguages: { language: string }[],
) {
  const nativeSpeakerSet = new Set(
    spokenLanguages
      .filter((l) => l.proficiency === "native")
      .map((l) => l.language),
  );
  const conflicts = learningLanguages
    .filter((l) => nativeSpeakerSet.has(l.language))
    .map((l) => l.language);
  if (conflicts.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Cannot add native-spoken language(s) as learning: ${conflicts.join(", ")}`,
    });
  }
}

async function syncMatchingEligibility(userId: string): Promise<boolean> {
  const [languages, interests] = await Promise.all([
    db.select({ type: userLanguage.type }).from(userLanguage).where(eq(userLanguage.userId, userId)),
    db.select({ id: userInterest.id }).from(userInterest).where(eq(userInterest.userId, userId)).limit(1),
  ]);

  const hasSpoken = languages.some((l) => l.type === "spoken");
  const hasLearning = languages.some((l) => l.type === "learning");
  const isEligible = hasSpoken && hasLearning && interests.length > 0;

  await db
    .update(languageProfile)
    .set({ onboardingComplete: isEligible })
    .where(eq(languageProfile.userId, userId));

  return isEligible;
}

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

      assertNoNativeSpokenLearningConflict(input.spokenLanguages, input.learningLanguages);

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
            proficiency: l.proficiency ?? null,
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

      domainEvents.emit("LanguageProfileUpdated", { userId, changedAt: new Date() });

      return { success: true };
    }),

  savePartialProfile: protectedProcedure
    .input(partialProfileInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      if (input.spokenLanguages && input.learningLanguages) {
        assertNoNativeSpokenLearningConflict(input.spokenLanguages, input.learningLanguages);
      }

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
              proficiency: l.proficiency ?? null,
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

      if (input.spokenLanguages || input.learningLanguages) {
        domainEvents.emit("LanguageProfileUpdated", { userId, changedAt: new Date() });
      }

      return { success: true };
    }),

  getOnboardingStatus: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const profile = await db.query.languageProfile.findFirst({
      where: eq(languageProfile.userId, userId),
      columns: { onboardingComplete: true },
    });

    return {
      complete: profile?.onboardingComplete ?? false,
      hasProfile: profile !== null,
    };
  }),

  submitProfile: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [languages, interests, existing] = await Promise.all([
      db.select().from(userLanguage).where(eq(userLanguage.userId, userId)),
      db.select().from(userInterest).where(eq(userInterest.userId, userId)),
      db.query.languageProfile.findFirst({
        where: eq(languageProfile.userId, userId),
        columns: { onboardingComplete: true },
      }),
    ]);

    const hasSpoken = languages.some((l) => l.type === "spoken");
    const hasLearning = languages.some((l) => l.type === "learning");
    const hasInterest = interests.length > 0;

    if (!hasSpoken || !hasLearning || !hasInterest) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Profile is incomplete. Add at least one spoken language, one learning language, and one interest.",
      });
    }

    const wasAlreadyEligible = existing?.onboardingComplete ?? false;

    if (existing) {
      await db
        .update(languageProfile)
        .set({ onboardingComplete: true })
        .where(eq(languageProfile.userId, userId));
    } else {
      await db.insert(languageProfile).values({ userId, onboardingComplete: true });
    }

    if (!wasAlreadyEligible) {
      domainEvents.emit("ProfileCompleted", { userId, completedAt: new Date() });
    }

    return { success: true };
  }),

  upsertLanguage: protectedProcedure
    .input(
      z.object({
        language: z.string(),
        type: z.enum(["spoken", "learning"]),
        proficiency: z
          .enum(["beginner", "intermediate", "advanced", "native"])
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      if (input.type === "learning") {
        // Reject if the language is already native-spoken
        const nativeRow = await db
          .select()
          .from(userLanguage)
          .where(
            and(
              eq(userLanguage.userId, userId),
              eq(userLanguage.language, input.language),
              eq(userLanguage.type, "spoken"),
            ),
          );
        if (nativeRow.some((r) => r.proficiency === "native")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `You already speak ${input.language} natively. Remove it from spoken first.`,
          });
        }
      }

      if (input.type === "spoken" && input.proficiency === "native") {
        // Auto-remove from learning to enforce the constraint
        await db
          .delete(userLanguage)
          .where(
            and(
              eq(userLanguage.userId, userId),
              eq(userLanguage.language, input.language),
              eq(userLanguage.type, "learning"),
            ),
          );
      }

      const existing = await db
        .select()
        .from(userLanguage)
        .where(
          and(
            eq(userLanguage.userId, userId),
            eq(userLanguage.language, input.language),
            eq(userLanguage.type, input.type),
          ),
        );

      if (existing.length > 0) {
        await db
          .update(userLanguage)
          .set({ proficiency: input.proficiency ?? null })
          .where(
            and(
              eq(userLanguage.userId, userId),
              eq(userLanguage.language, input.language),
              eq(userLanguage.type, input.type),
            ),
          );
      } else {
        await db.insert(userLanguage).values({
          userId,
          language: input.language,
          type: input.type,
          proficiency: input.proficiency ?? null,
        });
      }

      await syncMatchingEligibility(userId);
      domainEvents.emit("LanguageProfileUpdated", { userId, changedAt: new Date() });

      return { success: true };
    }),

  removeLanguage: protectedProcedure
    .input(
      z.object({
        language: z.string(),
        type: z.enum(["spoken", "learning"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      await db
        .delete(userLanguage)
        .where(
          and(
            eq(userLanguage.userId, userId),
            eq(userLanguage.language, input.language),
            eq(userLanguage.type, input.type),
          ),
        );

      await syncMatchingEligibility(userId);
      domainEvents.emit("LanguageProfileUpdated", { userId, changedAt: new Date() });

      return { success: true };
    }),

  toggleInterest: protectedProcedure
    .input(z.object({ interest: interestEnum }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const existing = await db
        .select()
        .from(userInterest)
        .where(
          and(
            eq(userInterest.userId, userId),
            eq(userInterest.interest, input.interest),
          ),
        );

      if (existing.length > 0) {
        await db
          .delete(userInterest)
          .where(
            and(
              eq(userInterest.userId, userId),
              eq(userInterest.interest, input.interest),
            ),
          );
      } else {
        await db.insert(userInterest).values({ userId, interest: input.interest });
      }

      await syncMatchingEligibility(userId);
      domainEvents.emit("InterestProfileUpdated", { userId, changedAt: new Date() });

      return { success: true };
    }),

  registerDeviceToken: protectedProcedure
    .input(
      z.object({
        token: z.string(),
        platform: z.enum(["ios", "android", "web"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Upsert: update if (userId, token) exists, insert otherwise
      await db
        .insert(userDeviceToken)
        .values({ userId, token: input.token, platform: input.platform })
        .onConflictDoUpdate({
          target: [userDeviceToken.userId, userDeviceToken.token],
          set: { platform: input.platform, updatedAt: new Date() },
        });

      return { success: true };
    }),

  getCandidateComments: protectedProcedure
    .input(z.object({ candidateUserId: z.string() }))
    .query(async ({ input }) => {
      const comments = await db
        .select({
          id: studentComment.id,
          content: studentComment.content,
          createdAt: studentComment.createdAt,
          authorName: user.name,
        })
        .from(studentComment)
        .leftJoin(user, eq(studentComment.authorId, user.id))
        .where(eq(studentComment.targetId, input.candidateUserId))
        .orderBy(studentComment.createdAt);

      return comments.map((c) => ({
        authorName: c.authorName ?? "Former Student",
        content: c.content,
        createdAt: c.createdAt.toISOString(),
      }));
    }),
});
