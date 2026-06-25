import { and, eq, ne, or, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@sip-and-speak/db";
import { languageProfile, userLanguage, userInterest, userDeviceToken } from "@sip-and-speak/db/schema/identity";
import { studentComment } from "@sip-and-speak/db/schema/moderation";
import { user, session, account } from "@sip-and-speak/db/schema/auth";
import { meetup } from "@sip-and-speak/db/schema/scheduling";
import { conversation } from "@sip-and-speak/db/schema/conversation";
import { protectedProcedure, router } from "../../index";
import { domainEvents } from "../../domain-events";
import {
  OnboardingProgression,
  OnboardingRuleError,
  type OnboardingSnapshot,
} from "./onboarding-progression";

/**
 * Load the cross-table snapshot the OnboardingProgression aggregate needs.
 * Reads identity + languages + interest count in parallel.
 */
async function loadOnboardingSnapshot(userId: string): Promise<OnboardingSnapshot> {
  const [identityRows, languageRows, interestRows] = await Promise.all([
    db
      .select({ name: user.name, surname: user.surname })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1),
    db
      .select({
        language: userLanguage.language,
        proficiency: userLanguage.proficiency,
        type: userLanguage.type,
      })
      .from(userLanguage)
      .where(eq(userLanguage.userId, userId)),
    db.select({ id: userInterest.id }).from(userInterest).where(eq(userInterest.userId, userId)),
  ]);
  return {
    identity: {
      name: identityRows[0]?.name ?? null,
      surname: identityRows[0]?.surname ?? null,
    },
    languages: languageRows.map((l) => ({
      language: l.language,
      proficiency: l.proficiency ?? undefined,
      type: l.type as "spoken" | "learning",
    })),
    interestCount: interestRows.length,
  };
}

const interestEnum = z.enum([
  "modern_art",
  "tech_coding",
  "jazz_music",
  "culinary_arts",
  "sustainability",
  "cinephile",
  "cosmology",
  "photography",
  "board_games",
  "hiking_outdoors",
  "yoga_wellness",
  "literature",
  "entrepreneurship",
  "design_architecture",
  "travel",
  "gaming",
  "fitness_sports",
  "philosophy",
  "theatre",
  "grocery_shopping",
  "family_conversations",
  "pronunciation_practice",
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
  try {
    OnboardingProgression.assertNoNativeSpokenLearningConflict({
      spoken: spokenLanguages,
      learning: learningLanguages,
    });
  } catch (err) {
    if (err instanceof OnboardingRuleError) {
      throw new TRPCError({ code: err.code, message: err.message });
    }
    throw err;
  }
}

async function syncMatchingEligibility(userId: string): Promise<boolean> {
  // The aggregate only needs language/interest counts here — identity is
  // already enforced elsewhere — so build a minimal snapshot.
  const [languages, interests] = await Promise.all([
    db.select({ type: userLanguage.type }).from(userLanguage).where(eq(userLanguage.userId, userId)),
    db.select({ id: userInterest.id }).from(userInterest).where(eq(userInterest.userId, userId)).limit(1),
  ]);

  // Identity is not part of the matching-eligibility rule, so we feed the
  // aggregate stub values for name/surname. `evaluate` returns the same
  // `matchingEligible` flag regardless.
  const snapshot: OnboardingSnapshot = {
    identity: { name: "x", surname: "x" },
    languages: languages.map((l) => ({ language: "", type: l.type as "spoken" | "learning" })),
    interestCount: interests.length,
  };
  const isEligible = OnboardingProgression.evaluate(snapshot).matchingEligible;

  await db
    .update(languageProfile)
    .set({ onboardingComplete: isEligible })
    .where(eq(languageProfile.userId, userId));

  return isEligible;
}

/**
 * #447/#446 — Soft-delete an account.
 *
 * Hard-deleting the user row used to cascade away every meetup and conversation,
 * which broke the *other* party's history and silently skipped the meetup
 * `cancelled` transition. Instead we keep the row and:
 *   1. Cancel in-progress meetups (pending/confirmed) and notify the partners
 *      (reusing the `ProposalsCancelledByCascade` cascade the moderation context
 *      already wires to push notifications).
 *   2. Close open conversations (read-only, history preserved).
 *   3. Remove the user from the matching pool.
 *   4. Scrub PII and stamp `deletedAt` so every surface treats them as an
 *      unavailable/placeholder user.
 *   5. Revoke auth (sessions, credentials, device tokens) so the account can no
 *      longer be accessed.
 *
 * Exported for integration testing.
 */
export async function softDeleteAccount(userId: string): Promise<void> {
  const now = new Date();

  // 1. Cancel in-progress meetups and collect the affected partners.
  const activeMeetups = await db
    .select({ id: meetup.id, proposerId: meetup.proposerId, receiverId: meetup.receiverId })
    .from(meetup)
    .where(
      and(
        or(eq(meetup.proposerId, userId), eq(meetup.receiverId, userId)),
        inArray(meetup.status, ["pending", "confirmed"]),
      ),
    );

  if (activeMeetups.length > 0) {
    await db
      .update(meetup)
      .set({ status: "cancelled" })
      .where(
        and(
          or(eq(meetup.proposerId, userId), eq(meetup.receiverId, userId)),
          inArray(meetup.status, ["pending", "confirmed"]),
        ),
      );

    const peerIds = [
      ...new Set(
        activeMeetups.map((m) => (m.proposerId === userId ? m.receiverId : m.proposerId)),
      ),
    ];
    domainEvents.emit("ProposalsCancelledByCascade", { targetId: userId, peerIds });
  }

  // 2. Close any open conversations — history stays, but they become read-only.
  await db
    .update(conversation)
    .set({ status: "closed" })
    .where(
      and(
        or(eq(conversation.user1Id, userId), eq(conversation.user2Id, userId)),
        eq(conversation.status, "open"),
      ),
    );

  // 3. Drop out of the matching pool.
  await db
    .update(languageProfile)
    .set({ onboardingComplete: false })
    .where(eq(languageProfile.userId, userId));

  // 4. Scrub PII and mark soft-deleted. The email is anonymized but kept unique
  //    (the column has a unique constraint) so the original address can later
  //    re-register.
  await db
    .update(user)
    .set({
      deletedAt: now,
      studentStatus: "removed",
      name: "Deleted user",
      surname: null,
      image: null,
      email: `deleted+${userId}@deleted.invalid`,
      emailVerified: false,
    })
    .where(eq(user.id, userId));

  // 5. Revoke all access for the account.
  await Promise.all([
    db.delete(session).where(eq(session.userId, userId)),
    db.delete(account).where(eq(account.userId, userId)),
    db.delete(userDeviceToken).where(eq(userDeviceToken.userId, userId)),
  ]);
}

const setIdentityProfileInput = z.object({
  name: z.string().trim().min(1, "Name is required"),
  surname: z.string().trim().min(1, "Surname is required"),
  imageUrl: z.string().optional(),
});


export const profileRouter = router({
  setIdentityProfile: protectedProcedure
    .input(setIdentityProfileInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const existing = await db
        .select({ surname: user.surname })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      const previousSurname = existing[0]?.surname ?? null;

      await db
        .update(user)
        .set({ name: input.name, surname: input.surname, image: input.imageUrl ?? null })
        .where(eq(user.id, userId));

      if (previousSurname === null) {
        domainEvents.emit("StudentProfileCompleted", { userId, completedAt: new Date() });
      } else {
        domainEvents.emit("StudentProfileUpdated", { userId, updatedAt: new Date() });
      }

      return { success: true };
    }),

  getMyProfile: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [profile, languages, interests, identity] = await Promise.all([
      db.query.languageProfile.findFirst({
        where: eq(languageProfile.userId, userId),
      }),
      db.select().from(userLanguage).where(eq(userLanguage.userId, userId)),
      db.select().from(userInterest).where(eq(userInterest.userId, userId)),
      db
        .select({ name: user.name, surname: user.surname, image: user.image, email: user.email })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1),
    ]);

    return {
      profile: profile ?? null,
      languages,
      interests,
      identity: identity[0] ?? null,
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

    const [profile, snapshot] = await Promise.all([
      db.query.languageProfile.findFirst({
        where: eq(languageProfile.userId, userId),
        columns: { onboardingComplete: true },
      }),
      loadOnboardingSnapshot(userId),
    ]);

    const state = OnboardingProgression.evaluate(snapshot);
    return {
      complete: profile?.onboardingComplete ?? false,
      hasProfile: profile !== null,
      identityProfileComplete: state.identityComplete,
      // New surface: which phase the Student is in + what's still missing.
      phase: state.phase,
      missingFields: state.missingFields,
    };
  }),

  submitProfile: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [snapshot, existing] = await Promise.all([
      loadOnboardingSnapshot(userId),
      db.query.languageProfile.findFirst({
        where: eq(languageProfile.userId, userId),
        columns: { onboardingComplete: true },
      }),
    ]);

    try {
      OnboardingProgression.assertCanSubmit(snapshot);
    } catch (err) {
      if (err instanceof OnboardingRuleError) {
        throw new TRPCError({ code: err.code, message: err.message });
      }
      throw err;
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

      // Every category must always retain at least one language (mirrors the
      // onboarding invariant). Only guard when the language actually exists in
      // the category — removing a non-existent one is a harmless no-op.
      const ofType = await db
        .select()
        .from(userLanguage)
        .where(
          and(eq(userLanguage.userId, userId), eq(userLanguage.type, input.type)),
        );

      const removingExisting = ofType.some((r) => r.language === input.language);
      if (removingExisting) {
        try {
          OnboardingProgression.assertCanRemoveLanguage(input.type, ofType.length);
        } catch (err) {
          if (err instanceof OnboardingRuleError) {
            throw new TRPCError({ code: err.code, message: err.message });
          }
          throw err;
        }
      }

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

      // Remove token from any other user (same physical device, different account)
      await db
        .delete(userDeviceToken)
        .where(and(eq(userDeviceToken.token, input.token), ne(userDeviceToken.userId, userId)));

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

  // #447/#446 — account deletion is a SOFT delete. We retain the user row so
  // existing conversations and meetup history don't break or vanish for the
  // other party; instead the row is scrubbed of PII and marked `deletedAt`.
  // The destructive client confirm is the guard, so no input here.
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    await softDeleteAccount(userId);
    console.info("[AccountDeleted]", { userId });
    return { success: true as const };
  }),
});
