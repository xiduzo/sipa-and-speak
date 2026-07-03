// Interest slug → human label lookup.
//
// Deliberate duplicate of the canonical native module
// `apps/native/utils/interest-labels.ts` — the web app shares no runtime
// package with the native app that could host this (packages/ui is web-only;
// @sip-and-speak/api is only ever type-imported on the client). Keep the two
// lists in sync; the slugs themselves are validated server-side by
// `interestEnum` in `packages/api/src/contexts/identity/profile.ts`.

const INTEREST_LABELS: Record<string, string> = {
  modern_art: "Art",
  tech_coding: "Tech",
  jazz_music: "Music",
  culinary_arts: "Cooking",
  sustainability: "Sustainability",
  cinephile: "Film",
  cosmology: "Science",
  photography: "Photography",
  board_games: "Board games",
  hiking_outdoors: "Hiking",
  yoga_wellness: "Yoga",
  literature: "Books",
  entrepreneurship: "Startups",
  design_architecture: "Design",
  travel: "Travel",
  gaming: "Gaming",
  fitness_sports: "Fitness",
  philosophy: "Philosophy",
  theatre: "Theatre",
  grocery_shopping: "Grocery shopping",
  family_conversations: "Family",
  pronunciation_practice: "Pronunciation",
};

export function interestLabel(value: string): string {
  return INTEREST_LABELS[value] ?? value;
}
