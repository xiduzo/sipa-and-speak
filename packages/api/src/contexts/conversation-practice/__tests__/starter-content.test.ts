/**
 * Tests for:
 *   #404 — Curate and serve conversation-starter content per language
 *
 * Covers the curated content module and its pure lookup helper. The four
 * Gherkin scenarios from #404 are each named in an `it` block below.
 */
import { describe, expect, it } from "bun:test";

import {
  CURATED_LANGUAGES,
  STARTER_CARDS,
  getStartersForLanguage,
} from "../starter-content";

describe("#404 — curated conversation-starter content", () => {
  it("Scenario: At least 30 cards per selectable language", () => {
    expect(CURATED_LANGUAGES.length).toBeGreaterThan(0);
    for (const language of CURATED_LANGUAGES) {
      const cards = getStartersForLanguage(language);
      expect(cards.length).toBeGreaterThanOrEqual(30);
    }
  });

  it("Scenario: Each card carries an English translation", () => {
    for (const language of CURATED_LANGUAGES) {
      for (const card of getStartersForLanguage(language)) {
        expect(typeof card.id).toBe("string");
        expect(card.id.length).toBeGreaterThan(0);
        expect(typeof card.text).toBe("string");
        expect(card.text.trim().length).toBeGreaterThan(0);
        expect(typeof card.translation).toBe("string");
        expect(card.translation.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("Scenario: Each card carries an English translation — English maps translation === text", () => {
    for (const card of getStartersForLanguage("English")) {
      expect(card.translation).toBe(card.text);
    }
  });

  it("Scenario: Uncurated language returns no cards", () => {
    expect(getStartersForLanguage("Klingon")).toEqual([]);
    expect(getStartersForLanguage("")).toEqual([]);
    expect(getStartersForLanguage("dutch")).toEqual([]); // case-sensitive key
  });

  it("Scenario: Card order is stable", () => {
    for (const language of CURATED_LANGUAGES) {
      const first = getStartersForLanguage(language);
      const second = getStartersForLanguage(language);
      expect(second.map((c) => c.id)).toEqual(first.map((c) => c.id));
      expect(second.map((c) => c.text)).toEqual(first.map((c) => c.text));
    }
  });

  it("assigns unique, language-prefixed, stable ids within each language", () => {
    for (const language of CURATED_LANGUAGES) {
      const ids = getStartersForLanguage(language).map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(getStartersForLanguage("Dutch")[0]?.id).toBe("nl-001");
    expect(getStartersForLanguage("English")[0]?.id).toBe("en-001");
  });

  it("curates English, Dutch, Spanish, German and French", () => {
    expect(CURATED_LANGUAGES).toEqual(
      expect.arrayContaining(["English", "Dutch", "Spanish", "German", "French"]),
    );
  });

  it("exposes the same number of cards per language (aligned deck positions)", () => {
    const counts = CURATED_LANGUAGES.map((l) => STARTER_CARDS[l]?.length ?? 0);
    expect(new Set(counts).size).toBe(1);
  });
});
