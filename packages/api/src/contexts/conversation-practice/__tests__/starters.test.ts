/**
 * Integration test for:
 *   #404 — content.starters.listByLanguage
 *
 * Drives the real tRPC caller so the procedure contract (input validation,
 * protected access, response shape) is verified through the actual router.
 */
import "../../../__test-support__/harness";

import { describe, it, expect } from "bun:test";

import { appRouter } from "../../../routers";
import { buildSessionContext } from "../../../__test-support__/harness";

const USER_ID = "u-starters";

function caller() {
  return appRouter.createCaller(buildSessionContext(USER_ID));
}

describe("#404 — content.starters.listByLanguage", () => {
  it("Scenario: At least 30 cards per selectable language", async () => {
    const result = await caller().content.starters.listByLanguage({ language: "Dutch" });
    expect(result.language).toBe("Dutch");
    expect(result.cards.length).toBeGreaterThanOrEqual(30);
  });

  it("Scenario: Each card carries an English translation", async () => {
    const result = await caller().content.starters.listByLanguage({ language: "Dutch" });
    const card = result.cards[0];
    expect(card?.text.trim().length).toBeGreaterThan(0);
    expect(card?.translation.trim().length).toBeGreaterThan(0);
    expect(card?.text).not.toBe(card?.translation); // Dutch text differs from English
  });

  it("Scenario: Uncurated language returns no cards", async () => {
    const result = await caller().content.starters.listByLanguage({ language: "Klingon" });
    expect(result).toEqual({ language: "Klingon", cards: [] });
  });

  it("Scenario: Card order is stable", async () => {
    const a = await caller().content.starters.listByLanguage({ language: "Spanish" });
    const b = await caller().content.starters.listByLanguage({ language: "Spanish" });
    expect(b.cards.map((c) => c.id)).toEqual(a.cards.map((c) => c.id));
  });

  it("echoes the requested language back in the response", async () => {
    const result = await caller().content.starters.listByLanguage({ language: "French" });
    expect(result.language).toBe("French");
    expect(result.cards.length).toBeGreaterThanOrEqual(30);
  });

  it("requires authentication (protected procedure)", async () => {
    const anonCaller = appRouter.createCaller({ session: null } as never);
    await expect(
      anonCaller.content.starters.listByLanguage({ language: "Dutch" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
