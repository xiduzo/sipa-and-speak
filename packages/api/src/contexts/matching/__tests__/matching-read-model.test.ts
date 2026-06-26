/**
 * Integration tests for the Matching read model (`getRankedCandidates`). Uses
 * the in-memory pg-mem harness to seed students + languages and exercises the
 * candidate query → grouping → scoring → pagination path directly, without
 * driving the full tRPC `discover` procedure.
 */
import "../../../__test-support__/harness";

import { describe, it, expect, beforeEach } from "bun:test";

import { db } from "@sip-and-speak/db";
import { user } from "@sip-and-speak/db/schema/auth";
import { languageProfile, userLanguage } from "@sip-and-speak/db/schema/identity";

import { getRankedCandidates } from "../matching-read-model";
import { resetDb } from "../../../__test-support__/harness";

// Caller speaks Dutch, learns English — the perspective every case ranks against.
const ME = "u-me";

type SeedOpts = {
  spoken: string[];
  learning: string[];
  onboardingComplete?: boolean;
  studentStatus?: "active" | "suspended" | "removed";
  deletedAt?: Date | null;
};

async function seedStudent(id: string, opts: SeedOpts): Promise<void> {
  await db.insert(user).values({
    id,
    name: id,
    email: `${id}@example.com`,
    emailVerified: true,
    studentStatus: opts.studentStatus ?? "active",
    deletedAt: opts.deletedAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(languageProfile).values({
    userId: id,
    onboardingComplete: opts.onboardingComplete ?? true,
  });
  const langs = [
    ...opts.spoken.map((language) => ({ userId: id, language, type: "spoken" as const })),
    ...opts.learning.map((language) => ({ userId: id, language, type: "learning" as const })),
  ];
  if (langs.length > 0) {
    await db.insert(userLanguage).values(langs);
  }
}

const seedMe = () => seedStudent(ME, { spoken: ["nl"], learning: ["en"] });

describe("matching read model — getRankedCandidates", () => {
  beforeEach(() => {
    resetDb();
  });

  it("returns complementary partners with compatible languages and omits non-complementary ones", async () => {
    await seedMe();
    // Mutual teach/learn with ME.
    await seedStudent("u-en", { spoken: ["en"], learning: ["nl"] });
    // No language complementarity → must not appear.
    await seedStudent("u-none", { spoken: ["es"], learning: ["fr"] });

    const { partners } = await getRankedCandidates(ME, { limit: 20 });

    expect(partners.map((p) => p.userId)).toEqual(["u-en"]);
    expect(partners[0]!.compatibleLanguages.sort()).toEqual(["en", "nl"]);
  });

  it("excludes candidates who have not completed onboarding", async () => {
    await seedMe();
    await seedStudent("u-en", {
      spoken: ["en"],
      learning: ["nl"],
      onboardingComplete: false,
    });

    const { partners, nextCursor } = await getRankedCandidates(ME, { limit: 20 });

    expect(partners).toHaveLength(0);
    expect(nextCursor).toBeUndefined();
  });

  it("excludes suspended and soft-deleted students even when complementary", async () => {
    await seedMe();
    await seedStudent("u-susp", { spoken: ["en"], learning: ["nl"], studentStatus: "suspended" });
    await seedStudent("u-del", { spoken: ["en"], learning: ["nl"], deletedAt: new Date() });
    await seedStudent("u-ok", { spoken: ["en"], learning: ["nl"] });

    const { partners } = await getRankedCandidates(ME, { limit: 20 });

    expect(partners.map((p) => p.userId)).toEqual(["u-ok"]);
  });

  it("paginates with limit and cursor, exposing nextCursor only while more remain", async () => {
    await seedMe();
    await seedStudent("u-1", { spoken: ["en"], learning: ["nl"] });
    await seedStudent("u-2", { spoken: ["en"], learning: ["nl"] });

    const page1 = await getRankedCandidates(ME, { limit: 1 });
    expect(page1.partners).toHaveLength(1);
    expect(page1.nextCursor).toBe("1");

    const page2 = await getRankedCandidates(ME, { limit: 1, cursor: page1.nextCursor });
    expect(page2.partners).toHaveLength(1);
    expect(page2.nextCursor).toBeUndefined();

    const ids = [page1.partners[0]!.userId, page2.partners[0]!.userId].sort();
    expect(ids).toEqual(["u-1", "u-2"]);
  });
});
