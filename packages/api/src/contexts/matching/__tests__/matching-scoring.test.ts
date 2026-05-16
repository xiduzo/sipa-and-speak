/**
 * Tests for the pure scoring functions in matching-utils.
 * No DB required.
 *
 * Covers:
 *   - computeLanguageScore: bidirectional complementarity
 *   - scoreCandidates: end-to-end scoring and filtering
 */
import { describe, it, expect } from "bun:test";

import {
  computeLanguageScore,
  scoreCandidates,
  type CandidateProfile,
} from "../matching-utils";

// ── computeLanguageScore ──────────────────────────────────────────────────────

describe("computeLanguageScore", () => {
  it("returns 1.0 when both directions match (mutual teach/learn)", () => {
    expect(computeLanguageScore(["Dutch"], ["English"], ["English"], ["Dutch"])).toBe(1.0);
  });

  it("returns 1.0 when both want to practice a shared learning language", () => {
    expect(computeLanguageScore(["Dutch"], ["English"], ["French"], ["English"])).toBe(1.0);
  });

  it("returns 0 when only partner speaks what user learns (one-directional)", () => {
    expect(computeLanguageScore(["Dutch"], ["English"], ["English"], ["French"])).toBe(0);
  });

  it("returns 0 when only partner learns what user speaks (one-directional)", () => {
    expect(computeLanguageScore(["Dutch"], ["French"], ["English"], ["Dutch"])).toBe(0);
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

// ── scoreCandidates ───────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<CandidateProfile> = {}): CandidateProfile {
  return {
    userId: "candidate-1",
    name: "Test User",
    image: null,
    bio: null,
    university: null,
    age: null,
    spokenLanguages: [{ language: "English", proficiency: "C1" }],
    learningLanguages: ["Dutch"],
    interests: [],
    ...overrides,
  };
}

const ME = {
  spoken: ["Dutch"],
  learning: ["English"],
};

describe("scoreCandidates", () => {
  it("returns empty array when no candidates", () => {
    expect(scoreCandidates(ME, [])).toEqual([]);
  });

  it("returns candidate with score 1 on language match", () => {
    const result = scoreCandidates(ME, [makeCandidate()]);
    expect(result).toHaveLength(1);
    expect(result[0]!.score).toBe(1);
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

    const result = scoreCandidates(ME, [dutch, english], { language: "English" });
    expect(result).toHaveLength(1);
    expect(result[0]!.userId).toBe("english-speaker");
  });

  it("excludes candidate with no language complementarity", () => {
    const noMatch = makeCandidate({
      userId: "no-match",
      spokenLanguages: [{ language: "Spanish", proficiency: "B2" }],
      learningLanguages: ["French"],
    });

    const result = scoreCandidates(ME, [noMatch]);
    expect(result).toHaveLength(0);
  });

  it("includes candidate who shares a learning language with the user (mutual practice)", () => {
    const sharedLearner = makeCandidate({
      userId: "shared-learner",
      spokenLanguages: [{ language: "Spanish", proficiency: "B2" }],
      learningLanguages: ["English"],
    });

    const result = scoreCandidates(ME, [sharedLearner]);
    expect(result).toHaveLength(1);
    expect(result[0]!.userId).toBe("shared-learner");
  });

  it("excludes candidate with only one-directional language benefit", () => {
    const oneWay = makeCandidate({
      userId: "one-way",
      spokenLanguages: [{ language: "English", proficiency: "C1" }],
      learningLanguages: ["French"],
    });

    const result = scoreCandidates(ME, [oneWay]);
    expect(result).toHaveLength(0);
  });

  it("excludes candidate who speaks user's language but does not learn what user speaks", () => {
    const noExchange = makeCandidate({
      userId: "no-exchange",
      spokenLanguages: [{ language: "Dutch", proficiency: "C2" }],
      learningLanguages: ["French"],
    });

    const result = scoreCandidates(ME, [noExchange]);
    expect(result).toHaveLength(0);
  });
});
