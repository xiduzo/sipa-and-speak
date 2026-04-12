import { describe, expect, it } from "bun:test";

import {
  computeLanguageScore,
  computeBridgeRuleEligibility,
} from "../routers/matching.scoring";

describe("computeLanguageScore", () => {
  describe("Bidirectional language compatibility filter", () => {
    it("Strict bidirectional match scores highest", () => {
      // A speaks Dutch and learns English; partner speaks English and learns Dutch
      const score = computeLanguageScore(
        ["Dutch"],    // userSpoken
        ["English"],  // userLearning
        ["English"],  // partnerSpoken
        ["Dutch"],    // partnerLearning
      );
      expect(score).toBe(1.0);
    });

    it("One-directional match scores lower", () => {
      // A speaks Dutch and learns English; partner speaks English but learns French (not Dutch)
      const score = computeLanguageScore(
        ["Dutch"],    // userSpoken
        ["English"],  // userLearning
        ["English"],  // partnerSpoken
        ["French"],   // partnerLearning
      );
      expect(score).toBe(0.5);
    });

    it("No language overlap scores zero", () => {
      // A speaks Dutch and learns English; partner speaks Japanese and learns Mandarin
      const score = computeLanguageScore(
        ["Dutch"],     // userSpoken
        ["English"],   // userLearning
        ["Japanese"],  // partnerSpoken
        ["Mandarin"],  // partnerLearning
      );
      expect(score).toBe(0.0);
    });
  });

  describe("edge cases", () => {
    it("empty user arrays score zero", () => {
      const score = computeLanguageScore([], [], ["English"], ["Dutch"]);
      expect(score).toBe(0.0);
    });

    it("empty partner arrays score zero", () => {
      const score = computeLanguageScore(["Dutch"], ["English"], [], []);
      expect(score).toBe(0.0);
    });

    it("multiple spoken languages — bidirectional if any pair matches", () => {
      const score = computeLanguageScore(
        ["Dutch", "French"],
        ["English", "Spanish"],
        ["English", "German"],
        ["French", "Italian"],
      );
      // partnerSpeaksWhatUserLearns: English ∈ [English, German] ✓
      // partnerLearnsWhatUserSpeaks: French ∈ [Dutch, French] ✓
      expect(score).toBe(1.0);
    });
  });
});

describe("computeBridgeRuleEligibility", () => {
  describe("Dutch/English bridge matching rule", () => {
    it("Bridge-eligible candidate is included in suggestion results", () => {
      // Candidate offers Dutch and is learning English
      const eligible = computeBridgeRuleEligibility(["Dutch"], ["English"]);
      expect(eligible).toBe(true);
    });

    it("Candidate offering Dutch targeting only an unrelated language is excluded", () => {
      // Candidate offers Dutch but learns only Japanese
      const eligible = computeBridgeRuleEligibility(["Dutch"], ["Japanese"]);
      expect(eligible).toBe(false);
    });

    it("Candidate not offering Dutch is excluded by bridge rule", () => {
      // Candidate offers English and learns Dutch — does not offer Dutch
      const eligible = computeBridgeRuleEligibility(["English"], ["Dutch"]);
      expect(eligible).toBe(false);
    });

    it("Candidate offering Dutch targeting Dutch is bridge-eligible", () => {
      // Dutch native targeting Dutch (heritage learner edge case)
      const eligible = computeBridgeRuleEligibility(["Dutch"], ["Dutch"]);
      expect(eligible).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("empty candidate language arrays return false", () => {
      expect(computeBridgeRuleEligibility([], [])).toBe(false);
    });

    it("candidate offering Dutch with multiple learning languages qualifies if Dutch or English is included", () => {
      const eligible = computeBridgeRuleEligibility(
        ["Dutch", "German"],
        ["Japanese", "English"],
      );
      expect(eligible).toBe(true);
    });
  });
});
