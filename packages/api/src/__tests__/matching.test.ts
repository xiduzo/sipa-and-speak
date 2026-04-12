import { describe, expect, it } from "bun:test";

import {
  computeLanguageScore,
  computeBridgeRuleEligibility,
  applySuggestionCap,
  excludeRequestedCandidates,
  SUGGESTION_LIST_LIMIT,
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

// Helper to build minimal scored candidates for cap/exclusion tests
function makeCandidates(n: number): { userId: string; score: number }[] {
  return Array.from({ length: n }, (_, i) => ({
    userId: `user-${i + 1}`,
    score: n - i, // descending scores: user-1 is highest
  }));
}

describe("applySuggestionCap", () => {
  describe("Suggestion list query", () => {
    it("Student receives up to 10 compatible candidates when more than 10 exist", () => {
      const candidates = makeCandidates(15);
      const result = applySuggestionCap(candidates);
      expect(result.length).toBe(SUGGESTION_LIST_LIMIT);
    });

    it("returns exactly as many candidates as exist when fewer than 10 compatible candidates exist", () => {
      const candidates = makeCandidates(3);
      const result = applySuggestionCap(candidates);
      expect(result.length).toBe(3);
    });

    it("returns empty list when no compatible candidates exist", () => {
      const result = applySuggestionCap([]);
      expect(result.length).toBe(0);
    });

    it("results are sorted by score descending", () => {
      const candidates = [
        { userId: "a", score: 0.3 },
        { userId: "b", score: 0.9 },
        { userId: "c", score: 0.6 },
      ];
      const result = applySuggestionCap(candidates);
      expect(result[0]?.userId).toBe("b");
      expect(result[1]?.userId).toBe("c");
      expect(result[2]?.userId).toBe("a");
    });
  });
});

describe("excludeRequestedCandidates", () => {
  it("Already-requested candidates are excluded from suggestion list", () => {
    const candidates = [
      { userId: "user-1", score: 0.9 },
      { userId: "user-2", score: 0.8 },
      { userId: "user-3", score: 0.7 },
    ];
    const requestedIds = new Set(["user-2"]);
    const result = excludeRequestedCandidates(candidates, requestedIds);
    expect(result.map((c) => c.userId)).toEqual(["user-1", "user-3"]);
  });

  it("returns all candidates when no requests have been sent", () => {
    const candidates = makeCandidates(3);
    const result = excludeRequestedCandidates(candidates, new Set());
    expect(result.length).toBe(3);
  });

  it("returns empty list when all candidates have been requested", () => {
    const candidates = [{ userId: "user-1", score: 0.9 }];
    const result = excludeRequestedCandidates(candidates, new Set(["user-1"]));
    expect(result.length).toBe(0);
  });
});
