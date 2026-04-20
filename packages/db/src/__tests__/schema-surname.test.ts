import { describe, it, expect } from "bun:test";
import { user } from "../schema/auth";

describe("user table schema — surname column", () => {
  it("defines a surname column", () => {
    expect(user.surname).toBeDefined();
  });

  it("surname is nullable (no notNull constraint)", () => {
    const col = user.surname as { notNull: boolean };
    expect(col.notNull).toBe(false);
  });

  it("surname is a text column", () => {
    const col = user.surname as { dataType: string };
    expect(col.dataType).toBe("string");
  });
});
