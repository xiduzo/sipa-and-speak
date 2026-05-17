import { Pressable, Text, View } from "react-native";

import { CARD } from "./tokens";
import { formatDayTime } from "./format";
import type { HomeState } from "./home-state";

type Props = {
  state: HomeState;
  onPress: () => void;
};

function describe(state: HomeState): { eyebrow: string; title: string; subtitle: string; emoji: string } {
  switch (state.kind) {
    case "post":
      return {
        eyebrow: "RATE",
        title: `How was ${state.meetup.partner.name}?`,
        subtitle: "Tap to rate",
        emoji: "✓",
      };
    case "confirmed":
      return {
        eyebrow: "UPCOMING",
        title: state.meetup.partner.name,
        subtitle: formatDayTime(state.meetup.scheduledAt),
        emoji: "📍",
      };
    case "waiting":
      return state.proposal.isProposer
        ? {
            eyebrow: "WAITING",
            title: state.proposal.partner.name,
            subtitle: "Reply pending",
            emoji: "⏳",
          }
        : {
            eyebrow: "ACTION",
            title: state.proposal.partner.name,
            subtitle: "Needs your reply",
            emoji: "✉️",
          };
    case "matchfound":
      return {
        eyebrow: "NEW MATCH",
        title: state.match.partnerName,
        subtitle: "Propose a meetup",
        emoji: "☕",
      };
    case "nomeetup":
      return {
        eyebrow: "DISCOVER",
        title: state.matchCount > 0 ? `${state.matchCount} matches waiting` : "Browse partners",
        subtitle: "Find someone new",
        emoji: "🔎",
      };
  }
}

export function SecondaryCard({ state, onPress }: Props) {
  const { eyebrow, title, subtitle, emoji } = describe(state);
  return (
    <Pressable
      testID={`secondary-${state.kind}`}
      onPress={onPress}
      className="flex-1 rounded-2xl p-4"
      style={{ backgroundColor: CARD, minHeight: 110 }}
    >
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text
        className="font-manrope-semi tracking-widest text-brand-muted-foreground mt-2"
        style={{ fontSize: 10 }}
      >
        {eyebrow}
      </Text>
      <Text
        className="text-brand-foreground font-manrope-bold mt-1"
        style={{ fontSize: 14 }}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Text
        className="text-brand-muted-foreground font-manrope"
        style={{ fontSize: 12 }}
        numberOfLines={1}
      >
        {subtitle}
      </Text>
    </Pressable>
  );
}
