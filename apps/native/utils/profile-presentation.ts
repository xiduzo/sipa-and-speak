// Pure profile → view-data shaping shared by every surface that renders a
// person: avatar tone + initials, and the Speaks/Learning/Topics sections.
// No React — mirrors the extracted-projection pattern of
// `components/home/home-state.ts`.

import { interestLabel } from "@/utils/interest-labels";
import { getLanguageFlag } from "@/utils/language-flags";

export const AVATAR_PALETTE = [
  "#E8B5AA", // rose
  "#B5CFC6", // sage
  "#D4B59E", // peach
  "#D6B7C2", // mauve
  "#E6D4B8", // sand
  "#C9D5C0", // moss
  "#E2C5B0", // clay
] as const;

/** Deterministic pastel tone for a seed (partner name or id). */
export function avatarTone(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) % 4096;
  }
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]!;
}

/** First + last initial ("Anna de Vries" → "AV"); "?" when empty. */
export function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (
    parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)
  ).toUpperCase();
}

/** Single leading initial ("Anna" → "A"); "?" when empty. */
export function firstInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

export type ProfileSectionItem = {
  /** Stable identity — language name or interest slug. Use as list key. */
  value: string;
  /** Human label — language name or interest label (never a raw slug). */
  label: string;
  /** Language flag emoji; null for topics. */
  flag: string | null;
  /** Proficiency for spoken languages; null otherwise. */
  detail: string | null;
};

export type ProfileSection = {
  title: string;
  items: ProfileSectionItem[];
};

export type ProfileSections = {
  speaks: ProfileSection;
  learning: ProfileSection;
  topics: ProfileSection;
};

export type ProfileSectionsInput = {
  spokenLanguages: { language: string; proficiency: string | null }[];
  learningLanguages: string[];
  interests: string[];
};

/**
 * The Speaks/Learning/Topics view data for a partner profile. Screens own
 * chip styling and how much of each item they show ({flag} {label} {detail}
 * vs just {label}); the mapping from raw profile data to human labels lives
 * here, once.
 */
export function profileSections(profile: ProfileSectionsInput): ProfileSections {
  return {
    speaks: {
      title: "Speaks",
      items: profile.spokenLanguages.map((l) => ({
        value: l.language,
        label: l.language,
        flag: getLanguageFlag(l.language),
        detail: l.proficiency,
      })),
    },
    learning: {
      title: "Learning",
      items: profile.learningLanguages.map((language) => ({
        value: language,
        label: language,
        flag: getLanguageFlag(language),
        detail: null,
      })),
    },
    topics: {
      title: "Topics",
      items: profile.interests.map((topic) => ({
        value: topic,
        label: interestLabel(topic),
        flag: null,
        detail: null,
      })),
    },
  };
}
