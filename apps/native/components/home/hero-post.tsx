import { useMutation } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { useState } from "react";

import { trpc, queryClient } from "@/utils/trpc";
import type { ConfirmedMeetup } from "./home-state";

const MINT = "#CFE3E0";
const DARK_GREEN = "#1F4744";

const EMOJIS: { rating: 1 | 2 | 3 | 4 | 5; glyph: string }[] = [
  { rating: 1, glyph: "🙁" },
  { rating: 2, glyph: "😐" },
  { rating: 3, glyph: "🙂" },
  { rating: 4, glyph: "😊" },
  { rating: 5, glyph: "🤩" },
];

type Props = {
  meetup: ConfirmedMeetup;
  onOpenChat: (conversationId: string) => void;
};

export function HeroPost({ meetup, onOpenChat }: Props) {
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  const reportMutation = useMutation(
    trpc.meetup.reportAttendance.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.meetup.getConfirmed.queryOptions());
      },
    }),
  );

  const optInMutation = useMutation(
    trpc.messaging.respondToOptIn.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.meetup.getConfirmed.queryOptions());
      },
    }),
  );

  function handleEmojiPress(rating: 1 | 2 | 3 | 4 | 5) {
    setSelectedRating(rating);
    reportMutation.mutate({ meetupId: meetup.meetupId, attended: true, rating });
  }

  function handleNoShow() {
    reportMutation.mutate({ meetupId: meetup.meetupId, attended: false });
  }

  function renderChatBanner() {
    const { mine, partner, conversationId } = meetup.optIn;

    if (conversationId) {
      return (
        <Pressable
          testID="chat-unlocked"
          onPress={() => onOpenChat(conversationId)}
          className="rounded-2xl mt-5 flex-row items-center justify-between p-4"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          <View>
            <Text
              className="font-manrope-semi tracking-widest"
              style={{ fontSize: 11, color: DARK_GREEN }}
            >
              UNLOCKED
            </Text>
            <Text
              className="font-manrope-bold mt-1"
              style={{ fontSize: 16, color: "#1A1A1A" }}
            >
              Chat with {meetup.partner.name}
            </Text>
          </View>
          <Text style={{ fontSize: 18 }}>→</Text>
        </Pressable>
      );
    }

    if (mine === null) {
      return (
        <Pressable
          testID="opt-in-cta"
          onPress={() =>
            optInMutation.mutate({ meetupId: meetup.meetupId, response: "accept" })
          }
          disabled={optInMutation.isPending}
          className="rounded-2xl mt-5 flex-row items-center justify-between p-4"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          <View>
            <Text
              className="font-manrope-semi tracking-widest"
              style={{ fontSize: 11, color: DARK_GREEN }}
            >
              STAY IN TOUCH?
            </Text>
            <Text
              className="font-manrope-bold mt-1"
              style={{ fontSize: 16, color: "#1A1A1A" }}
            >
              Chat with {meetup.partner.name} 🔒
            </Text>
          </View>
          <Text style={{ fontSize: 18 }}>→</Text>
        </Pressable>
      );
    }

    if (mine === "accept" && partner !== "accept" && partner !== "decline") {
      return (
        <View
          testID="opt-in-waiting"
          className="rounded-2xl mt-5 p-4"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          <Text
            className="font-manrope-semi tracking-widest"
            style={{ fontSize: 11, color: DARK_GREEN }}
          >
            WAITING
          </Text>
          <Text
            className="font-manrope mt-1"
            style={{ fontSize: 14, color: "#1A1A1A" }}
          >
            We&apos;ll let you know when {meetup.partner.name} accepts.
          </Text>
        </View>
      );
    }

    return null;
  }

  return (
    <View>
      <View
        testID="hero-post"
        className="rounded-3xl p-6 items-center"
        style={{ backgroundColor: MINT }}
      >
        <View
          className="items-center justify-center rounded-full"
          style={{ width: 56, height: 56, backgroundColor: DARK_GREEN }}
        >
          <Text style={{ fontSize: 26, color: "#FFFFFF" }}>✓</Text>
        </View>

        <Text
          className="text-brand-foreground font-jakarta mt-4 text-center"
          style={{ fontSize: 28 }}
        >
          How was {meetup.partner.name}?
        </Text>
        <Text
          className="text-brand-muted-foreground font-manrope mt-1 text-center"
          style={{ fontSize: 13 }}
        >
          {meetup.venue.name}
        </Text>

        <View className="flex-row gap-2 mt-5">
          {EMOJIS.map((e) => {
            const isSelected = selectedRating === e.rating;
            return (
              <Pressable
                key={e.rating}
                testID={`rating-${e.rating}`}
                onPress={() => handleEmojiPress(e.rating)}
                disabled={reportMutation.isPending}
                className="items-center justify-center rounded-full"
                style={{
                  width: isSelected ? 56 : 44,
                  height: isSelected ? 56 : 44,
                  backgroundColor: "#FFFFFF",
                  opacity: selectedRating !== null && !isSelected ? 0.4 : 1,
                }}
              >
                <Text style={{ fontSize: isSelected ? 28 : 22 }}>{e.glyph}</Text>
              </Pressable>
            );
          })}
        </View>

        {renderChatBanner()}

        <Pressable
          testID="no-show-link"
          onPress={handleNoShow}
          disabled={reportMutation.isPending}
          className="mt-4"
        >
          <Text
            className="font-manrope"
            style={{ fontSize: 12, color: DARK_GREEN, textDecorationLine: "underline" }}
          >
            We didn&apos;t meet
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
