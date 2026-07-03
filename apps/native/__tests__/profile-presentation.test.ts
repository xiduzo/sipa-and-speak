import {
  AVATAR_PALETTE,
  avatarTone,
  firstInitial,
  initials,
  profileSections,
} from "@/utils/profile-presentation";

describe("initials", () => {
  it("uses first + last name initials", () => {
    expect(initials("Anna de Vries")).toBe("AV");
  });

  it("uses a single initial for one-word names", () => {
    expect(initials("Anna")).toBe("A");
  });

  it("upper-cases", () => {
    expect(initials("anna vries")).toBe("AV");
  });

  it("collapses extra whitespace", () => {
    expect(initials("  Anna   de   Vries  ")).toBe("AV");
  });

  it("falls back to ? for empty names", () => {
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});

describe("firstInitial", () => {
  it("returns the upper-cased first letter", () => {
    expect(firstInitial("anna")).toBe("A");
  });

  it("ignores leading whitespace", () => {
    expect(firstInitial("  bob")).toBe("B");
  });

  it("falls back to ? for empty names", () => {
    expect(firstInitial("")).toBe("?");
    expect(firstInitial("   ")).toBe("?");
  });
});

describe("avatarTone", () => {
  it("is deterministic", () => {
    expect(avatarTone("Anna de Vries")).toBe(avatarTone("Anna de Vries"));
  });

  it("always returns a palette color", () => {
    for (const seed of ["", "Anna", "Bob", "Chidi Anagonye", "Éva", "李明"]) {
      expect(AVATAR_PALETTE).toContain(avatarTone(seed));
    }
  });

  it("spreads different seeds across tones", () => {
    const tones = new Set(
      ["Anna", "Bob", "Carla", "Dmitri", "Emma", "Femke", "Gio"].map(avatarTone),
    );
    expect(tones.size).toBeGreaterThan(1);
  });
});

describe("profileSections", () => {
  const profile = {
    spokenLanguages: [
      { language: "Dutch", proficiency: "advanced" },
      { language: "English", proficiency: null },
    ],
    learningLanguages: ["Italian"],
    interests: ["modern_art", "grocery_shopping", "unknown_slug"],
  };

  it("shapes spoken languages with flag + proficiency detail", () => {
    const { speaks } = profileSections(profile);
    expect(speaks.title).toBe("Speaks");
    expect(speaks.items).toEqual([
      { value: "Dutch", label: "Dutch", flag: "🇳🇱", detail: "advanced" },
      { value: "English", label: "English", flag: "🇬🇧", detail: null },
    ]);
  });

  it("shapes learning languages with flags and no detail", () => {
    const { learning } = profileSections(profile);
    expect(learning.title).toBe("Learning");
    expect(learning.items).toEqual([
      { value: "Italian", label: "Italian", flag: "🇮🇹", detail: null },
    ]);
  });

  it("maps interest slugs to human labels, keeping the slug as key", () => {
    const { topics } = profileSections(profile);
    expect(topics.title).toBe("Topics");
    expect(topics.items).toEqual([
      { value: "modern_art", label: "Art", flag: null, detail: null },
      {
        value: "grocery_shopping",
        label: "Grocery shopping",
        flag: null,
        detail: null,
      },
      // Unknown slugs pass through rather than disappearing.
      { value: "unknown_slug", label: "unknown_slug", flag: null, detail: null },
    ]);
  });

  it("returns empty sections for an empty profile", () => {
    const sections = profileSections({
      spokenLanguages: [],
      learningLanguages: [],
      interests: [],
    });
    expect(sections.speaks.items).toEqual([]);
    expect(sections.learning.items).toEqual([]);
    expect(sections.topics.items).toEqual([]);
  });
});
