import { Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/avatar";
import { CARD, GOLD } from "./tokens";
import type { MyMatch } from "./home-state";

type Props = {
  match: MyMatch;
  onPropose: () => void;
  onViewProfile: () => void;
};

export function HeroMatchFound({ match, onPropose, onViewProfile }: Props) {
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
          <Avatar
            name={match.partnerName}
            image={match.partnerPhotoUrl}
            size={64}
            fontSize={26}
            single
            tone="#E2C5BD"
          />
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
