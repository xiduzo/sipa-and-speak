/**
 * Tests for email-based name pre-fill utility
 */
import { extractNameFromEmail } from "@/utils/email-name-extract";
import { describe, it, expect } from "@jest/globals";

describe("extractNameFromEmail", () => {
  it("extracts capitalized name and surname from firstname.lastname format", () => {
    expect(extractNameFromEmail("sander.boer@student.tue.nl")).toEqual({ name: "Sander", surname: "Boer" });
  });

  it("extracts initial and surname from initial.lastname format", () => {
    expect(extractNameFromEmail("s.janssen@student.tue.nl")).toEqual({ name: "S", surname: "Janssen" });
  });

  it("returns empty name and capitalized local part for no-dot email", () => {
    expect(extractNameFromEmail("sander@tue.nl")).toEqual({ name: "", surname: "Sander" });
  });

  it("handles empty string", () => {
    expect(extractNameFromEmail("")).toEqual({ name: "", surname: "" });
  });
});
