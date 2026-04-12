import { describe, expect, it } from "bun:test";

import { ALUMNI_REGISTRY, isAlumniEmail } from "../alumni-registry";

describe("isAlumniEmail", () => {
  describe("email is in registry", () => {
    it("returns true for an exact match", () => {
      const [first] = ALUMNI_REGISTRY;
      if (!first) throw new Error("ALUMNI_REGISTRY must not be empty for tests");
      expect(isAlumniEmail(first)).toBe(true);
    });

    it("is case-insensitive", () => {
      const [first] = ALUMNI_REGISTRY;
      if (!first) throw new Error("ALUMNI_REGISTRY must not be empty for tests");
      expect(isAlumniEmail(first.toUpperCase())).toBe(true);
    });

    it("trims surrounding whitespace before checking", () => {
      const [first] = ALUMNI_REGISTRY;
      if (!first) throw new Error("ALUMNI_REGISTRY must not be empty for tests");
      expect(isAlumniEmail(`  ${first}  `)).toBe(true);
    });
  });

  describe("email is not in registry", () => {
    it("returns false for a TU/e student email", () => {
      expect(isAlumniEmail("s.janssen@student.tue.nl")).toBe(false);
    });

    it("returns false for a partial domain match", () => {
      expect(isAlumniEmail("doe@alumni.tue.nl")).toBe(false);
    });

    it("returns false for an empty string", () => {
      expect(isAlumniEmail("")).toBe(false);
    });

    it("returns false for a completely unknown email", () => {
      expect(isAlumniEmail("unknown@example.com")).toBe(false);
    });

    it("does not match on substring overlap", () => {
      // Ensure prefix tricks don't pass
      expect(isAlumniEmail("evil@j.doe@alumni.tue.nl")).toBe(false);
    });
  });

  describe("ALUMNI_REGISTRY list", () => {
    it("contains at least one entry", () => {
      expect(ALUMNI_REGISTRY.length).toBeGreaterThan(0);
    });

    it("all entries are lowercase emails containing @", () => {
      for (const entry of ALUMNI_REGISTRY) {
        expect(entry).toContain("@");
        expect(entry).toBe(entry.toLowerCase());
      }
    });
  });
});
