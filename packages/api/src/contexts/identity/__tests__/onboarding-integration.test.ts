/**
 * Integration test for the new getOnboardingStatus / submitProfile flow,
 * driven by the in-memory pg-mem harness so the aggregate's phase derivation
 * is verified through the actual tRPC caller.
 */
import "../../../__test-support__/harness";

import { describe, it, expect, beforeEach } from "bun:test";

import { db } from "@sip-and-speak/db";
import { user } from "@sip-and-speak/db/schema/auth";
import { userLanguage, userInterest } from "@sip-and-speak/db/schema/identity";

import { appRouter } from "../../../routers";
import { resetDb, buildSessionContext, captureEvents } from "../../../__test-support__/harness";

const USER_ID = "u-onb";

async function seedUser(overrides: { name?: string | null; surname?: string | null } = {}) {
  await db.insert(user).values({
    id: USER_ID,
    name: overrides.name ?? "",
    surname: overrides.surname ?? null,
    email: "onb@example.com",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("onboarding integration — getOnboardingStatus", () => {
  beforeEach(() => {
    resetDb();
  });

  it("phase=Registering when name+surname missing", async () => {
    await seedUser({ name: "", surname: "" });
    const caller = appRouter.createCaller(buildSessionContext(USER_ID));
    const status = await caller.profile.getOnboardingStatus();
    expect(status.phase).toBe("Registering");
    expect(status.identityProfileComplete).toBe(false);
    expect(status.missingFields).toEqual(
      expect.arrayContaining(["name", "surname", "spoken", "learning", "interest"]),
    );
  });

  it("phase=IdentitySet when identity set but profile data missing", async () => {
    await seedUser({ name: "Ada", surname: "Lovelace" });
    const caller = appRouter.createCaller(buildSessionContext(USER_ID));
    const status = await caller.profile.getOnboardingStatus();
    expect(status.phase).toBe("IdentitySet");
    expect(status.identityProfileComplete).toBe(true);
    expect(status.missingFields).toEqual(
      expect.arrayContaining(["spoken", "learning", "interest"]),
    );
  });

  it("phase=Submitted when all categories filled", async () => {
    await seedUser({ name: "Ada", surname: "Lovelace" });
    await db.insert(userLanguage).values([
      { userId: USER_ID, language: "en", proficiency: "native", type: "spoken" },
      { userId: USER_ID, language: "nl", proficiency: "beginner", type: "learning" },
    ]);
    await db.insert(userInterest).values({ userId: USER_ID, interest: "modern_art" });

    const caller = appRouter.createCaller(buildSessionContext(USER_ID));
    const status = await caller.profile.getOnboardingStatus();
    expect(status.phase).toBe("Submitted");
    expect(status.missingFields).toEqual([]);
  });
});

describe("onboarding integration — submitProfile", () => {
  beforeEach(() => {
    resetDb();
  });

  it("rejects with BAD_REQUEST when profile data incomplete", async () => {
    await seedUser({ name: "Ada", surname: "Lovelace" });
    const caller = appRouter.createCaller(buildSessionContext(USER_ID));
    await expect(caller.profile.submitProfile()).rejects.toThrow(/incomplete/);
  });

  it("emits ProfileCompleted on first successful submit", async () => {
    await seedUser({ name: "Ada", surname: "Lovelace" });
    await db.insert(userLanguage).values([
      { userId: USER_ID, language: "en", proficiency: "native", type: "spoken" },
      { userId: USER_ID, language: "nl", proficiency: "beginner", type: "learning" },
    ]);
    await db.insert(userInterest).values({ userId: USER_ID, interest: "modern_art" });

    const capture = captureEvents();
    const caller = appRouter.createCaller(buildSessionContext(USER_ID));
    const result = await caller.profile.submitProfile();
    capture.stop();

    expect(result.success).toBe(true);
    expect(capture.events.map((e) => e.name)).toContain("ProfileCompleted");
  });
});

describe("profile integration — removeLanguage min-one guard", () => {
  beforeEach(() => {
    resetDb();
  });

  it("rejects removing the last spoken language", async () => {
    await seedUser({ name: "Ada", surname: "Lovelace" });
    await db.insert(userLanguage).values([
      { userId: USER_ID, language: "en", proficiency: "native", type: "spoken" },
      { userId: USER_ID, language: "nl", proficiency: "beginner", type: "learning" },
    ]);

    const caller = appRouter.createCaller(buildSessionContext(USER_ID));
    await expect(
      caller.profile.removeLanguage({ language: "en", type: "spoken" }),
    ).rejects.toThrow(/at least one language in this category/);

    const remaining = await db.select().from(userLanguage);
    expect(remaining.some((r) => r.language === "en" && r.type === "spoken")).toBe(true);
  });

  it("rejects removing the last learning language", async () => {
    await seedUser({ name: "Ada", surname: "Lovelace" });
    await db.insert(userLanguage).values([
      { userId: USER_ID, language: "en", proficiency: "native", type: "spoken" },
      { userId: USER_ID, language: "nl", proficiency: "beginner", type: "learning" },
    ]);

    const caller = appRouter.createCaller(buildSessionContext(USER_ID));
    await expect(
      caller.profile.removeLanguage({ language: "nl", type: "learning" }),
    ).rejects.toThrow(/at least one language in this category/);
  });

  it("allows removing one when several remain in the category", async () => {
    await seedUser({ name: "Ada", surname: "Lovelace" });
    await db.insert(userLanguage).values([
      { userId: USER_ID, language: "en", proficiency: "native", type: "spoken" },
      { userId: USER_ID, language: "de", proficiency: "advanced", type: "spoken" },
      { userId: USER_ID, language: "nl", proficiency: "beginner", type: "learning" },
    ]);

    const caller = appRouter.createCaller(buildSessionContext(USER_ID));
    const result = await caller.profile.removeLanguage({ language: "de", type: "spoken" });
    expect(result.success).toBe(true);

    const remaining = await db.select().from(userLanguage);
    expect(remaining.some((r) => r.language === "de")).toBe(false);
    expect(remaining.filter((r) => r.type === "spoken")).toHaveLength(1);
  });
});
