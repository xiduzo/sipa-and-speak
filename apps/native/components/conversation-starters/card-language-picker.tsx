import { Pressable, Text, View } from "react-native";

import { getLanguageFlag, getNativeName } from "@/utils/language-flags";

export type ProfileLanguage = {
  language: string;
  type: "spoken" | "learning";
};

/**
 * De-duplicate the buddy's profile languages into the picker's option list.
 *
 * A language a buddy both speaks and is learning must appear exactly once. The
 * first occurrence wins so the original profile order is preserved.
 */
export function dedupeLanguages(languages: ProfileLanguage[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const { language } of languages) {
    if (seen.has(language)) {
      continue;
    }
    seen.add(language);
    result.push(language);
  }
  return result;
}

type CardLanguagePickerProps = {
  /** The buddy's profile languages (spoken + learning, possibly overlapping). */
  languages: ProfileLanguage[];
  /** The currently active card language, or null when nothing is selected yet. */
  activeLanguage: string | null;
  /** Called with the chosen language when the buddy taps an option. */
  onSelect: (language: string) => void;
};

/**
 * Lets a buddy pick which of *their own* profile languages to browse cards in.
 *
 * Shows only the de-duplicated union of the buddy's spoken + learning
 * languages — never the full catalogue — each with its flag and native name.
 * The active option is announced as selected for accessibility.
 */
export function CardLanguagePicker({
  languages,
  activeLanguage,
  onSelect,
}: CardLanguagePickerProps) {
  const options = dedupeLanguages(languages);

  return (
    <View testID="card-language-picker" accessibilityRole="radiogroup">
      <Text className="mb-3 text-center text-sm font-semibold text-foreground">
        Pick a language to practise
      </Text>
      <View className="gap-2">
        {options.map((language) => {
          const isActive = language === activeLanguage;
          return (
            <Pressable
              key={language}
              testID={`card-language-option-${language}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => onSelect(language)}
              className={`flex-row items-center gap-3 rounded-2xl px-4 py-3 ${
                isActive ? "bg-primary" : "bg-brand-gold"
              }`}
            >
              <Text style={{ fontSize: 24 }}>{getLanguageFlag(language)}</Text>
              <Text
                className={`text-base font-semibold ${
                  isActive ? "text-primary-foreground" : "text-foreground"
                }`}
              >
                {getNativeName(language)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
