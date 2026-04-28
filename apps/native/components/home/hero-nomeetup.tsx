import { Pressable, Text, View } from "react-native";

import { getLanguageCode } from "@/utils/language-flags";
import { CARD, GOLD } from "./tokens";
import type { DiscoverPartner } from "./home-state";

function uniqueLanguageCodes(partners: DiscoverPartner[]): string[] {
  const set = new Set<string>();
  for (const p of partners) {
    const native = p.spokenLanguages.find((l) => l.proficiency === "native");
    const lang = native?.language ?? p.spokenLanguages[0]?.language;
    if (lang) set.add(getLanguageCode(lang));
  }
  return Array.from(set);
}

type Props = {
  matchCount: number;
  partners: DiscoverPartner[];
  daysIdle?: number | null;
  onFindPartner: () => void;
};

export function HeroNoMeetup({ matchCount, partners, daysIdle, onFindPartner }: Props) {
  const langCodes = uniqueLanguageCodes(partners).slice(0, 4);
  const subline =
    daysIdle && daysIdle >= 7
      ? `You haven't scheduled an S&S moment in ${daysIdle} days.`
      : matchCount > 0
        ? "Pick a partner and break the ice."
        : "No new matches just now — check back soon.";

  return (
    <View>
      <Text
        className="text-brand-foreground font-jakarta"
        style={{ fontSize: 38, lineHeight: 42 }}
      >
        Time for a{"\n"}fresh cup?
      </Text>
      <Text
        className="text-brand-muted-foreground font-manrope mt-3"
        style={{ fontSize: 15 }}
      >
        {subline}
      </Text>

      <View
        testID="find-partner-card"
        className="rounded-3xl mt-8 p-5"
        style={{ backgroundColor: CARD }}
      >
        <View className="flex-row items-center gap-4">
          <View
            className="items-center justify-center rounded-full"
            style={{ width: 56, height: 56, backgroundColor: GOLD }}
          >
            <Text className="font-jakarta" style={{ fontSize: 22 }}>
              {matchCount}
            </Text>
          </View>
          <View className="flex-1">
            <Text
              className="text-brand-foreground font-manrope-bold"
              style={{ fontSize: 16 }}
            >
              {matchCount === 1
                ? "1 new match waiting"
                : `${matchCount} new matches waiting`}
            </Text>
            {langCodes.length > 0 && (
              <Text
                className="text-brand-muted-foreground font-manrope mt-0.5"
                style={{ fontSize: 13 }}
              >
                {langCodes.join(", ")} native speakers
              </Text>
            )}
          </View>
        </View>
        <Pressable
          testID="find-partner-button"
          onPress={onFindPartner}
          disabled={matchCount === 0}
          className="items-center justify-center rounded-full mt-4"
          style={{
            height: 52,
            backgroundColor: GOLD,
            opacity: matchCount === 0 ? 0.5 : 1,
          }}
        >
          <Text className="font-manrope-bold" style={{ fontSize: 16 }}>
            Find a partner  →
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
