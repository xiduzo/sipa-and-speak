const INTERESTS = [
  { value: "modern_art", label: "Art" },
  { value: "tech_coding", label: "Tech" },
  { value: "jazz_music", label: "Music" },
  { value: "culinary_arts", label: "Cooking" },
  { value: "sustainability", label: "Sustainability" },
  { value: "cinephile", label: "Film" },
  { value: "cosmology", label: "Science" },
  { value: "photography", label: "Photography" },
  { value: "board_games", label: "Board games" },
  { value: "hiking_outdoors", label: "Hiking" },
  { value: "yoga_wellness", label: "Yoga" },
  { value: "literature", label: "Books" },
  { value: "entrepreneurship", label: "Startups" },
  { value: "design_architecture", label: "Design" },
  { value: "travel", label: "Travel" },
  { value: "gaming", label: "Gaming" },
  { value: "fitness_sports", label: "Fitness" },
  { value: "philosophy", label: "Philosophy" },
  { value: "theatre", label: "Theatre" },
  { value: "grocery_shopping", label: "Grocery shopping" },
  { value: "family_conversations", label: "Family" },
  { value: "pronunciation_practice", label: "Pronunciation" },
] as const;

export function interestLabel(value: string): string {
  return INTERESTS.find((i) => i.value === value)?.label ?? value;
}

export { INTERESTS };
