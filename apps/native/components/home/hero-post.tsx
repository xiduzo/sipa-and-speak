import { useMutation } from "@tanstack/react-query";
import { Alert, Pressable, Text, View } from "react-native";

import { trpc, queryClient } from "@/utils/trpc";
import { GOLD } from "./tokens";
import type { ConfirmedMeetup } from "./home-state";

const MINT = "#CFE3E0";
const DARK_GREEN = "#1F4744";
const DARK = "#1A1A1A";
const OUTLINE = "#1A1A1A";

type Props = {
  meetup: ConfirmedMeetup;
  onOpenChat: (conversationId: string) => void;
  // #371 — route the locked keep-in-touch tile to the locked chat screen,
  // which owns the opt-in (accept/decline) prompt (see #370).
  onOpenLocked: (meetupId: string) => void;
  // #27 — re-open the propose flow after a "didn't meet" report.
  onReschedule: () => void;
};

export function HeroPost({ meetup, onOpenChat, onOpenLocked, onReschedule }: Props) {
  const reportMutation = useMutation(
    trpc.meetup.reportAttendance.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.meetup.getConfirmed.queryOptions());
      },
    }),
  );

  function handleAttended() {
    reportMutation.mutate(
      { meetupId: meetup.meetupId, attended: true },
      {
        onSuccess: () => {
          Alert.alert(
            "Thanks!",
            `You reported attending this meetup — wait for ${meetup.partner.name} to respond.`,
          );
        },
      },
    );
  }

  function handleNoShow() {
    reportMutation.mutate(
      { meetupId: meetup.meetupId, attended: false },
      {
        onSuccess: () => {
          // #27 — offer to schedule another moment with the same buddy.
          Alert.alert(
            "No worries",
            `Want to set up another moment with ${meetup.partner.name}?`,
            [
              { text: "Not now", style: "cancel" },
              { text: "Propose again", onPress: onReschedule },
            ],
          );
        },
      },
    );
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
          onPress={() => onOpenLocked(meetup.meetupId)}
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
          Did your meet-up take place?
        </Text>
        <Text
          className="text-brand-muted-foreground font-manrope mt-1 text-center"
          style={{ fontSize: 13 }}
        >
          {meetup.venue.name}
        </Text>

        <View className="flex-row mt-5" style={{ gap: 10 }}>
          <Pressable
            testID="attendance-yes-btn"
            onPress={handleAttended}
            disabled={reportMutation.isPending}
            className="flex-1 items-center justify-center rounded-full"
            style={{
              height: 46,
              paddingHorizontal: 22,
              backgroundColor: GOLD,
              opacity: reportMutation.isPending ? 0.55 : 1,
            }}
          >
            <Text className="font-manrope-bold" style={{ fontSize: 14, color: DARK }}>
              We met up
            </Text>
          </Pressable>
          <Pressable
            testID="attendance-no-btn"
            onPress={handleNoShow}
            disabled={reportMutation.isPending}
            className="flex-1 items-center justify-center rounded-full"
            style={{
              height: 46,
              paddingHorizontal: 22,
              borderWidth: 1.5,
              borderColor: OUTLINE,
              opacity: reportMutation.isPending ? 0.55 : 1,
            }}
          >
            <Text className="font-manrope-bold" style={{ fontSize: 14, color: DARK }}>
              We didn&apos;t
            </Text>
          </Pressable>
        </View>

        {renderChatBanner()}
      </View>
    </View>
  );
}
