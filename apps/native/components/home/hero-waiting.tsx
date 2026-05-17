import { Image, Pressable, Text, View } from "react-native";

import { CARD, GOLD } from "./tokens";
import { formatDayTime, formatRelativeTime } from "./format";
import type { PendingProposal } from "./home-state";

type Props = {
  proposal: PendingProposal;
  onRespond: () => void;
};

export function HeroWaiting({ proposal, onRespond }: Props) {
  const initial = (proposal.partner.name || "?").charAt(0).toUpperCase();
  const dayTime = formatDayTime(proposal.scheduledAt);
  const relative = formatRelativeTime(proposal.createdAt);

  if (proposal.isProposer) {
    return (
      <View>
        <Text
          className="font-manrope-semi tracking-widest text-brand-muted-foreground"
          style={{ fontSize: 12 }}
        >
          WAITING FOR REPLY
        </Text>

        <View
          testID="hero-waiting-outgoing"
          className="rounded-3xl mt-3 p-5"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          <View className="flex-row items-center gap-4">
            <View
              className="items-center justify-center rounded-full overflow-hidden"
              style={{ width: 64, height: 64, backgroundColor: "#E2C5BD" }}
            >
              {proposal.partner.image ? (
                <Image
                  source={{ uri: proposal.partner.image }}
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
                {proposal.partner.name}
              </Text>
              <Text
                className="text-brand-muted-foreground font-manrope mt-0.5"
                style={{ fontSize: 13 }}
              >
                Sent {relative.toLowerCase()}
              </Text>
            </View>
            <View
              testID="pulse-dot"
              style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: GOLD }}
            />
          </View>

          <View
            className="rounded-2xl mt-4 p-4"
            style={{ backgroundColor: CARD }}
          >
            <Text
              className="text-brand-muted-foreground font-manrope"
              style={{ fontSize: 12 }}
            >
              You proposed
            </Text>
            <Text
              className="text-brand-foreground font-manrope-bold mt-1"
              style={{ fontSize: 16 }}
            >
              {dayTime} · {proposal.venue.name}
            </Text>
          </View>

          <Text
            className="text-brand-muted-foreground font-manrope mt-4 italic"
            style={{ fontSize: 13 }}
          >
            Most replies come within a day. We&apos;ll nudge them for you.
          </Text>
        </View>
      </View>
    );
  }

  // Incoming — needs your response
  return (
    <View>
      <Text
        className="font-manrope-semi tracking-widest text-brand-muted-foreground"
        style={{ fontSize: 12 }}
      >
        NEEDS YOUR REPLY
      </Text>

      <View
        testID="hero-waiting-incoming"
        className="rounded-3xl mt-3 p-5"
        style={{ backgroundColor: "#FFFFFF" }}
      >
        <View className="flex-row items-center gap-4">
          <View
            className="items-center justify-center rounded-full overflow-hidden"
            style={{ width: 64, height: 64, backgroundColor: "#E2C5BD" }}
          >
            {proposal.partner.image ? (
              <Image
                source={{ uri: proposal.partner.image }}
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
              {proposal.partner.name}
            </Text>
            <Text
              className="text-brand-muted-foreground font-manrope mt-0.5"
              style={{ fontSize: 13 }}
            >
              proposed {relative.toLowerCase()}
            </Text>
          </View>
        </View>

        <View
          className="rounded-2xl mt-4 p-4"
          style={{ backgroundColor: CARD }}
        >
          <Text
            className="text-brand-foreground font-manrope-bold"
            style={{ fontSize: 16 }}
          >
            {dayTime} · {proposal.venue.name}
          </Text>
        </View>

        <Pressable
          testID="respond-cta"
          onPress={onRespond}
          className="items-center justify-center rounded-full mt-5"
          style={{ height: 52, backgroundColor: GOLD }}
        >
          <Text className="font-manrope-bold" style={{ fontSize: 16 }}>
            Respond  →
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
