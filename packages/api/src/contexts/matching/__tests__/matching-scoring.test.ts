/**
 * Tests for the pure scoring functions in matching-utils.
 * No DB required.
 *
 * Covers:
 *   - computeLanguageScore: bidirectional complementarity
 *   - computeInterestScore: overlap ratio
 *   - computeProximityScore: distance → score mapping
 *   - computeCompositeScore: weight modes
 *   - scoreCandidates: end-to-end scoring, filtering, and ranking
 */
import { describe, it, expect } from "bun:test";

import {
  computeLanguageScore,
  computeInterestScore,
  computeProximityScore,
  computeCompositeScore,
  scoreCandidates,
  type CandidateProfile,
} from "../matching-utils";

// ── computeLanguageScore ──────────────────────────────────────────────────────

describe("computeLanguageScore", () => {
  it("returns 1.0 when both directions match", () => {
    expect(computeLanguageScore(["Dutch"], ["English"], ["English"], ["Dutch"])).toBe(1.0);
  });

  it("returns 0.5 when only partner speaks what user learns", () => {
    expect(computeLanguageScore(["Dutch"], ["English"], ["English"], ["French"])).toBe(0.5);
  });

  it("returns 0.5 when only partner learns what user speaks", () => {
    expect(computeLanguageScore(["Dutch"], ["French"], ["English"], ["Dutch"])).toBe(0.5);
  });

  it("returns 0 when there is no complementarity", () => {
    expect(computeLanguageScore(["Dutch"], ["French"], ["English"], ["Spanish"])).toBe(0);
  });

  it("returns 0 when all arrays are empty", () => {
    expect(computeLanguageScore([], [], [], [])).toBe(0);
  });

  it("matches across multiple languages in each list", () => {
    expect(
      computeLanguageScore(
        ["Dutch", "German"],
        ["English", "French"],
        ["French", "Spanish"],
        ["Dutch"],
      ),
    ).toBe(1.0);
  });
});

// ── computeInterestScore ──────────────────────────────────────────────────────

describe("computeInterestScore", () => {
  it("returns 1.0 when all interests overlap", () => {
    expect(computeInterestScore(["hiking", "chess"], ["hiking", "chess"])).toBe(1.0);
  });

  it("returns 0.5 when half overlap (shorter list is subset)", () => {
    expect(computeInterestScore(["hiking", "chess"], ["hiking", "cooking"])).toBeCloseTo(0.5);
  });

  it("returns 0 when no interests overlap", () => {
    expect(computeInterestScore(["hiking"], ["chess"])).toBe(0);
  });

  it("returns 0 when both lists are empty", () => {
    expect(computeInterestScore([], [])).toBe(0);
  });

  it("uses max list length as denominator (asymmetric lists)", () => {
    // 1 shared out of max(1, 3) = 3
    expect(computeInterestScore(["hiking"], ["hiking", "chess", "cooking"])).toBeCloseTo(1 / 3);
  });
});

// ── computeProximityScore ─────────────────────────────────────────────────────

describe("computeProximityScore", () => {
  it("returns 1.0 at distance 0", () => {
    expect(computeProximityScore(0)).toBe(1.0);
  });

  it("returns 0 at max radius (50 km)", () => {
    expect(computeProximityScore(50)).toBe(0);
  });

  it("returns 0 beyond max radius", () => {
    expect(computeProximityScore(100)).toBe(0);
  });

  it("returns 0.5 at half the max radius", () => {
    expect(computeProximityScore(25)).toBeCloseTo(0.5);
  });

  it("respects a custom maxRadius", () => {
    expect(computeProximityScore(10, 10)).toBe(0);
    expect(computeProximityScore(5, 10)).toBeCloseTo(0.5);
  });
});

// ── computeCompositeScore ─────────────────────────────────────────────────────

describe("computeCompositeScore", () => {
  it("uses default weights (language 0.5, interest 0.3, proximity 0.2) when no filter", () => {
    expect(computeCompositeScore(1, 1, 1)).toBeCloseTo(1.0);
    expect(computeCompositeScore(1, 0, 0)).toBeCloseTo(0.5);
    expect(computeCompositeScore(0, 1, 0)).toBeCloseTo(0.3);
    expect(computeCompositeScore(0, 0, 1)).toBeCloseTo(0.2);
  });

  it("uses near_you weights (language 0.3, interest 0.2, proximity 0.5)", () => {
    expect(computeCompositeScore(1, 1, 1, "near_you")).toBeCloseTo(1.0);
    expect(computeCompositeScore(1, 0, 0, "near_you")).toBeCloseTo(0.3);
    expect(computeCompositeScore(0, 0, 1, "near_you")).toBeCloseTo(0.5);
  });

  it("uses default weights when filter is 'language'", () => {
    expect(computeCompositeScore(1, 0, 0, "language")).toBeCloseTo(0.5);
  });
});

// ── scoreCandidates ───────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<CandidateProfile> = {}): CandidateProfile {
  return {
    userId: "candidate-1",
    name: "Test User",
    image: null,
    bio: null,
    university: null,
    age: null,
    latitude: null,
    longitude: null,
    spokenLanguages: [{ language: "English", proficiency: "C1" }],
    learningLanguages: ["Dutch"],
    interests: [],
    ...overrides,
  };
}

const ME = {
  spoken: ["Dutch"],
  learning: ["English"],
  interests: [],
  latitude: null,
  longitude: null,
};

describe("scoreCandidates", () => {
  it("returns empty array when no candidates", () => {
    expect(scoreCandidates(ME, [])).toEqual([]);
  });

  it("scores and returns all candidates when no filter", () => {
    const result = scoreCandidates(ME, [makeCandidate()]);
    expect(result).toHaveLength(1);
    expect(result[0]!.score).toBeGreaterThan(0);
  });

  it("sorts candidates by score descending", () => {
    const perfect = makeCandidate({
      userId: "perfect",
      spokenLanguages: [{ language: "English", proficiency: "C1" }],
      learningLanguages: ["Dutch"],
    });
    const noMatch = makeCandidate({
      userId: "no-match",
      spokenLanguages: [{ language: "Spanish", proficiency: "B2" }],
      learningLanguages: ["French"],
    });

    const result = scoreCandidates(ME, [noMatch, perfect]);
    expect(result[0]!.userId).toBe("perfect");
    expect(result[1]!.userId).toBe("no-match");
  });

  it("excludes candidates who don't speak the filter language", () => {
    const dutch = makeCandidate({
      userId: "dutch-speaker",
      spokenLanguages: [{ language: "Dutch", proficiency: "C2" }],
    });
    const english = makeCandidate({
      userId: "english-speaker",
      spokenLanguages: [{ language: "English", proficiency: "C1" }],
    });

    const result = scoreCandidates(ME, [dutch, english], { mode: "language", language: "English" });
    expect(result).toHaveLength(1);
    expect(result[0]!.userId).toBe("english-speaker");
  });

  it("does not apply language filter when mode is 'near_you'", () => {
    const candidates = [
      makeCandidate({ userId: "a", spokenLanguages: [{ language: "Spanish", proficiency: "B2" }] }),
      makeCandidate({ userId: "b", spokenLanguages: [{ language: "English", proficiency: "C1" }] }),
    ];

    const result = scoreCandidates(ME, candidates, { mode: "near_you" });
    expect(result).toHaveLength(2);
  });

  it("computes distance and includes it in result", () => {
    const me = { ...ME, latitude: 51.45, longitude: 5.45 };
    const nearby = makeCandidate({
      userId: "nearby",
      latitude: 51.46,
      longitude: 5.46,
    });

    const result = scoreCandidates(me, [nearby]);
    expect(result[0]!.distance).not.toBeNull();
    expect(result[0]!.distance).toBeGreaterThan(0);
  });

  it("sets distance to null when either party has no coordinates", () => {
    const result = scoreCandidates(ME, [makeCandidate()]);
    expect(result[0]!.distance).toBeNull();
  });

  it("near_you filter boosts proximity weight over language weight", () => {
    const me = { ...ME, latitude: 51.45, longitude: 5.45 };
    // languageMatch: perfect language, far away
    const languageMatch = makeCandidate({
      userId: "language-match",
      spokenLanguages: [{ language: "English", proficiency: "C1" }],
      learningLanguages: ["Dutch"],
      latitude: 51.45 + 0.4, // ~44 km away
      longitude: 5.45,
    });
    // nearbyMatch: imperfect language, very close
    const nearbyMatch = makeCandidate({
      userId: "nearby-match",
      spokenLanguages: [{ language: "Spanish", proficiency: "B2" }],
      learningLanguages: ["French"],
      latitude: 51.451, // < 1 km away
      longitude: 5.451,
    });

    const defaultResult = scoreCandidates(me, [languageMatch, nearbyMatch]);
    const nearYouResult = scoreCandidates(me, [languageMatch, nearbyMatch], { mode: "near_you" });

    // Default: language-heavy → language match wins
    expect(defaultResult[0]!.userId).toBe("language-match");
    // near_you: proximity-heavy → nearby match wins
    expect(nearYouResult[0]!.userId).toBe("nearby-match");
  });
});
