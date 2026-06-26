/**
 * Identity read model — the query side of the Identity context.
 *
 * The Identity write side (profile mutations, language/interest edits, account
 * deletion) lives in `profile.ts` and owns its invariants. This module owns the
 * read side: the parallel cross-table fetch and row-shaping that assemble a
 * Student's own profile — the language profile, their spoken/learning languages,
 * their interests, and the identity fields (name, surname, image, email) — into
 * the single view shape the native app renders.
 *
 * Pulling the assembly out of the router gives the shaping a small interface
 * (`userId`) over a multi-table read, and makes it testable through the harness
 * without driving the full tRPC procedure. Mirrors the Meetup read model.
 */
import { eq } from "drizzle-orm";
import { db } from "@sip-and-speak/db";
import { languageProfile, userLanguage, userInterest } from "@sip-and-speak/db/schema/identity";
import { user } from "@sip-and-speak/db/schema/auth";

/**
 * The signed-in Student's own profile: the language profile row (or null before
 * onboarding), every spoken/learning language, every interest, and the identity
 * fields. Assembled from four parallel reads keyed on `userId`.
 */
export async function getProfileForUser(userId: string) {
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
}
