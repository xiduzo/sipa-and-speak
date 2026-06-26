/**
 * Integration test for the Identity read model (getProfileForUser), driven by
 * the in-memory pg-mem harness so the multi-table assembly is verified against
 * real queries rather than mocks. Mirrors the Meetup read model's coverage.
 */
import "../../../__test-support__/harness";

import { describe, it, expect, beforeEach } from "bun:test";

import { db } from "@sip-and-speak/db";
import { user } from "@sip-and-speak/db/schema/auth";
import { languageProfile, userLanguage, userInterest } from "@sip-and-speak/db/schema/identity";

import { getProfileForUser } from "../profile-read-model";
import { resetDb } from "../../../__test-support__/harness";

const USER_ID = "u-prof";

async function seedUser(
  overrides: { name?: string; surname?: string | null; image?: string | null; email?: string } = {},
) {
  await db.insert(user).values({
    id: USER_ID,
    name: overrides.name ?? "Ada",
    surname: overrides.surname ?? "Lovelace",
    image: overrides.image ?? null,
    email: overrides.email ?? "prof@example.com",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("identity read model — getProfileForUser", () => {
  beforeEach(() => {
    resetDb();
  });

  it("assembles the full profile shape for an onboarded student", async () => {
    await seedUser();
    await db.insert(languageProfile).values({
      userId: USER_ID,
      bio: "Hi there",
      university: "Cambridge",
      onboardingComplete: true,
    });
    await db.insert(userLanguage).values([
      { userId: USER_ID, language: "en", proficiency: "native", type: "spoken" },
      { userId: USER_ID, language: "nl", proficiency: "beginner", type: "learning" },
    ]);
    await db.insert(userInterest).values([
      { userId: USER_ID, interest: "modern_art" },
      { userId: USER_ID, interest: "jazz_music" },
    ]);

    const result = await getProfileForUser(USER_ID);

    expect(result.profile?.bio).toBe("Hi there");
    expect(result.profile?.university).toBe("Cambridge");
    expect(result.profile?.onboardingComplete).toBe(true);
    expect(result.languages).toHaveLength(2);
    expect(result.interests).toHaveLength(2);
    expect(result.identity).toEqual({
      name: "Ada",
      surname: "Lovelace",
      image: null,
      email: "prof@example.com",
    });
  });

  it("returns profile: null and empty collections before onboarding", async () => {
    await seedUser();

    const result = await getProfileForUser(USER_ID);

    expect(result.profile).toBeNull();
    expect(result.languages).toEqual([]);
    expect(result.interests).toEqual([]);
    expect(result.identity?.name).toBe("Ada");
  });

  it("returns identity: null for an unknown user", async () => {
    const result = await getProfileForUser("nobody");

    expect(result.profile).toBeNull();
    expect(result.languages).toEqual([]);
    expect(result.interests).toEqual([]);
    expect(result.identity).toBeNull();
  });

  it("exposes only the whitelisted identity fields", async () => {
    await seedUser({ image: "https://example.com/ada.png" });

    const result = await getProfileForUser(USER_ID);

    expect(Object.keys(result.identity ?? {}).sort()).toEqual(
      ["email", "image", "name", "surname"].sort(),
    );
    expect(result.identity?.image).toBe("https://example.com/ada.png");
  });
});
