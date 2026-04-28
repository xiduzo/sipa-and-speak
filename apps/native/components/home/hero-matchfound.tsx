import { Image, Pressable, Text, View } from "react-native";

import { CARD, GOLD } from "./tokens";
import type { MyMatch } from "./home-state";

type Props = {
  match: MyMatch;
  onPropose: () => void;
  onViewProfile: () => void;
};

export function HeroMatchFound({ match, onPropose, onViewProfile }: Props) {
  const initial = (match.partnerName || "?").charAt(0).toUpperCase();

  return (
    <View>
      <Text
        className="font-manrope-semi tracking-widest text-brand-muted-foreground"
        style={{ fontSize: 12 }}
      >
        NEW MATCH
      </Text>

      <View
        testID="hero-matchfound"
        className="rounded-3xl mt-3 p-5"
        style={{ backgroundColor: "#FFFFFF" }}
      >
        <View className="flex-row items-center gap-4">
          <View
            className="items-center justify-center rounded-full overflow-hidden"
            style={{ width: 64, height: 64, backgroundColor: "#E2C5BD" }}
          >
            {match.partnerPhotoUrl ? (
              <Image
                source={{ uri: match.partnerPhotoUrl }}
                style={{ width: 64, height: 64 }}
              />
            ) : (
              <Text className="font-jakarta" style={{ fontSize: 26 }}>
                {initial}
              </Text>
            )}
          </View>
          <View className="flex-1">
            <Text
              className="text-brand-foreground font-jakarta"
              style={{ fontSize: 22 }}
            >
              {match.partnerName}
            </Text>
          </View>
        </View>

        <Pressable
          testID="propose-meetup-cta"
          onPress={onPropose}
          className="items-center justify-center rounded-full mt-5"
          style={{ height: 52, backgroundColor: GOLD }}
        >
          <Text className="font-manrope-bold" style={{ fontSize: 16 }}>
            Propose a meetup  →
          </Text>
        </Pressable>

        <Pressable
          testID="view-profile-link"
          onPress={onViewProfile}
          className="items-center mt-3"
        >
          <Text
            className="text-brand-muted-foreground font-manrope"
            style={{ fontSize: 14 }}
          >
            See full profile
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// Re-export used colors so consumers don't need separate import.
export { CARD as MATCHFOUND_CARD };
