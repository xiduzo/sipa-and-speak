import { describe, expect, it } from "bun:test";

import { normalizeAlumniEmail } from "../alumni-registry";

// The alumni registry is now DB-backed (see alumni-registry.ts). Exact-match
// lookup is delegated to the `alumni` table's unique constraint, identical to
// the blocklist pattern. These unit tests cover the normalization contract
// that both writes and lookups rely on for case-insensitive, trimmed matching.
describe("normalizeAlumniEmail", () => {
  it("lowercases the address", () => {
    expect(normalizeAlumniEmail("J.Doe@Gmail.com")).toBe("j.doe@gmail.com");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeAlumniEmail("  a.smith@gmail.com  ")).toBe(
      "a.smith@gmail.com",
    );
  });

  it("lowercases and trims together", () => {
    expect(normalizeAlumniEmail("  M.Van.Den.Berg@GMAIL.com ")).toBe(
      "m.van.den.berg@gmail.com",
    );
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeAlumniEmail("   ")).toBe("");
  });
});
