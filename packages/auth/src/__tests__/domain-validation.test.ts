import { describe, it, expect } from "bun:test";
import { validateTueDomain, TUE_DOMAINS } from "../domain-validation";

describe("validateTueDomain", () => {
  describe("accepted domains", () => {
    it("accepts @student.tue.nl", () => {
      expect(validateTueDomain("s.janssen@student.tue.nl")).toBe(true);
    });

    it("accepts @tue.nl", () => {
      expect(validateTueDomain("j.doe@tue.nl")).toBe(true);
    });

    it("is case-insensitive", () => {
      expect(validateTueDomain("S.JANSSEN@STUDENT.TUE.NL")).toBe(true);
      expect(validateTueDomain("J.DOE@TUE.NL")).toBe(true);
    });

    it("trims surrounding whitespace before checking", () => {
      expect(validateTueDomain("  s.janssen@student.tue.nl  ")).toBe(true);
    });
  });

  describe("rejected domains", () => {
    it("rejects misspelled TU/e domain @tuu.nl", () => {
      expect(validateTueDomain("s.janssen@tuu.nl")).toBe(false);
    });

    it("rejects non-TU/e domain @gmail.com", () => {
      expect(validateTueDomain("student@gmail.com")).toBe(false);
    });

    it("rejects subdomain not in the list @dept.tue.nl", () => {
      expect(validateTueDomain("user@dept.tue.nl")).toBe(false);
    });

    it("rejects prefix tricks like notastudent.tue.nl@evil.com", () => {
      expect(validateTueDomain("user@student.tue.nl.evil.com")).toBe(false);
    });

    it("rejects an empty string", () => {
      expect(validateTueDomain("")).toBe(false);
    });
  });

  describe("TUE_DOMAINS list", () => {
    it("contains both accepted domains", () => {
      expect(TUE_DOMAINS).toContain("@student.tue.nl");
      expect(TUE_DOMAINS).toContain("@tue.nl");
    });
  });
});
