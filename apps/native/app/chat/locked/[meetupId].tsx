import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Text, TouchableOpacity, View } from "react-native";

import { Container } from "@/components/container";
import { queryClient, trpc } from "@/utils/trpc";

type LockedPhase =
  | "scheduled"
  | "awaiting_attendance"
  | "awaiting_partner_attendance"
  | "awaiting_my_optin"
  | "awaiting_partner_optin"
  | "declined";

type LockedEntry = {
  kind: "locked";
  id: string;
  meetupId: string;
  partner: { id: string; name: string; image: string | null };
  venue: { id: string; name: string; photoUrl: string | null };
  meetupAt: string;
  phase: LockedPhase;
};

function copyForPhase(phase: LockedPhase, partnerFirstName: string) {
  switch (phase) {
    case "scheduled":
      return {
        headline: "Meet first. Message after.",
        body: "Chat opens after you both meet and choose to keep in touch.",
        cta: "See meetup details",
      };
    case "awaiting_attendance":
      return {
        headline: "Did you show up?",
        body: "Confirm attendance to unlock the chat.",
        cta: "Report attendance",
      };
    case "awaiting_partner_attendance":
      return {
        headline: `Waiting for ${partnerFirstName} to confirm you met`,
        body: "You've confirmed. The chat opens once they confirm too.",
        cta: "See meetup details",
      };
    case "awaiting_my_optin":
      return {
        headline: "Would you like to chat and keep in touch?",
        body: "Chat opens as soon as you both say yes.",
        cta: "Open meetup",
      };
    case "awaiting_partner_optin":
      return {
        headline: `Waiting for ${partnerFirstName} to enable chatting`,
        body: "You said yes. Chat opens when they reply too.",
        cta: "See meetup details",
      };
    case "declined":
      return {
        headline: "This chat won't open",
        body: "One of you decided not to continue. No hard feelings.",
        cta: "Back to chats",
      };
  }
}

function headerSubtitle(phase: LockedPhase): string {
  if (phase === "scheduled") return "locked · meet first";
  if (phase === "awaiting_attendance") return "locked · awaiting attendance";
  if (phase === "awaiting_partner_attendance") return "locked · waiting on partner";
  if (phase === "awaiting_my_optin") return "locked · rate to unlock";
  if (phase === "awaiting_partner_optin") return "locked · waiting to enable chatting";
  return "won't open";
}

const FAKE_BUBBLES: Array<{ width: number; align: "left" | "right" }> = [
  { width: 180, align: "left" },
  { width: 220, align: "right" },
  { width: 140, align: "left" },
  { width: 96, align: "left" },
];

export default function LockedChatScreen() {
  const { meetupId } = useLocalSearchParams<{ meetupId: string }>();
  const router = useRouter();

  const { data: entries = [], isLoading } = useQuery(
    trpc.chat.listEntries.queryOptions(),
  );
  const entry = (entries as Array<LockedEntry | { kind: "open" }>).find(
    (e): e is LockedEntry => e.kind === "locked" && e.meetupId === meetupId,
  );

  const optInMutation = useMutation(
    trpc.messaging.respondToOptIn.mutationOptions({
      onSuccess: (data) => {
        void queryClient.invalidateQueries(trpc.chat.listEntries.queryOptions());
        void queryClient.invalidateQueries(trpc.meetup.getConfirmed.queryOptions());
        // Both opted in → the locked entry is gone and a real conversation
        // exists. Route into it instead of stranding on "Chat not available".
        if (data.conversationId) {
          router.replace(`/chat/${data.conversationId}`);
        }
      },
      onError: (err) => Alert.alert("Couldn't save", err.message),
    }),
  );

  const reportAttendanceMutation = useMutation(
    trpc.meetup.reportAttendance.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.chat.listEntries.queryOptions());
        void queryClient.invalidateQueries(trpc.meetup.getConfirmed.queryOptions());
      },
      onError: (err) => Alert.alert("Couldn't save", err.message),
    }),
  );

  if (isLoading) {
    return (
      <Container isScrollable={false}>
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted-foreground">Loading…</Text>
        </View>
      </Container>
    );
  }

  if (!entry) {
    return (
      <Container isScrollable={false}>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-foreground text-base font-semibold mb-2">
            Chat not available
          </Text>
          <Text className="text-muted-foreground text-center">
            This meetup may have been cancelled or already opened.
          </Text>
          <TouchableOpacity
            className="mt-6 bg-foreground rounded-full px-6 py-3"
            onPress={() => router.back()}
          >
            <Text className="text-background font-semibold">Back</Text>
          </TouchableOpacity>
        </View>
      </Container>
    );
  }

  const partnerFirst = entry.partner.name.split(" ")[0] ?? entry.partner.name;
  const copy = copyForPhase(entry.phase, partnerFirst);
  const subtitle = headerSubtitle(entry.phase);

  function handleCta() {
    if (entry?.phase === "declined") {
      router.back();
      return;
    }
    router.push("/(tabs)/confirmed-meetups");
  }

  return (
    <Container isScrollable={false}>
      <View
        testID="locked-chat-header"
        className="flex-row items-center px-4 py-3 border-b border-border"
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color="#2C1810" />
        </TouchableOpacity>
        <View className="w-10 h-10 rounded-full bg-muted items-center justify-center mr-3">
          <Text className="text-foreground font-bold">
            {entry.partner.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-foreground font-bold text-base">
            {entry.partner.name}
          </Text>
          <View className="flex-row items-center gap-1 mt-0.5">
            <View className="w-1.5 h-1.5 rounded-full bg-brand-green" />
            <Text testID="locked-status" className="text-muted-foreground text-xs">
              {subtitle}
            </Text>
          </View>
        </View>
        <Ionicons name="information-circle-outline" size={22} color="#6F605B" />
      </View>

      <View testID="fake-bubbles" className="flex-1 px-4 py-6">
        {FAKE_BUBBLES.map((b, i) => (
          <View
            key={i}
            className={`my-1 rounded-2xl bg-muted/60 h-9 ${b.align === "right" ? "self-end" : "self-start"}`}
            style={{ width: b.width, opacity: 0.5 }}
          />
        ))}
      </View>

      <View
        testID="locked-card"
        className="mx-4 mb-6 rounded-3xl p-4"
        style={{ backgroundColor: "#F2C94C" }}
      >
        <View className="flex-row items-start gap-3 mb-4">
          <View
            className="w-11 h-11 rounded-full items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.08)" }}
          >
            <Ionicons name="lock-closed" size={20} color="#2C1810" />
          </View>
          <View className="flex-1">
            <Text className="text-foreground font-bold text-lg leading-tight">
              {copy.headline}
            </Text>
            <Text className="text-foreground/80 text-sm mt-1">{copy.body}</Text>
          </View>
        </View>

        {entry.phase === "awaiting_my_optin" ? (
          <View className="gap-2">
            <TouchableOpacity
              testID="opt-in-cta"
              disabled={optInMutation.isPending}
              onPress={() =>
                optInMutation.mutate({ meetupId: entry.meetupId, response: "accept" })
              }
              className="rounded-full py-3.5 items-center"
              style={{ backgroundColor: "#2C1810", opacity: optInMutation.isPending ? 0.6 : 1 }}
            >
              <Text className="text-background font-semibold">Yes, keep in touch</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="opt-in-decline"
              disabled={optInMutation.isPending}
              onPress={() =>
                optInMutation.mutate({ meetupId: entry.meetupId, response: "decline" })
              }
              className="rounded-full py-3.5 items-center border"
              style={{ borderColor: "#2C1810", opacity: optInMutation.isPending ? 0.6 : 1 }}
            >
              <Text className="text-foreground font-semibold">No thanks</Text>
            </TouchableOpacity>
          </View>
        ) : entry.phase === "awaiting_attendance" ? (
          <View className="gap-2">
            <TouchableOpacity
              testID="attendance-yes"
              disabled={reportAttendanceMutation.isPending}
              onPress={() =>
                reportAttendanceMutation.mutate({ meetupId: entry.meetupId, attended: true })
              }
              className="rounded-full py-3.5 items-center"
              style={{ backgroundColor: "#2C1810", opacity: reportAttendanceMutation.isPending ? 0.6 : 1 }}
            >
              <Text className="text-background font-semibold">We met up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="attendance-no"
              disabled={reportAttendanceMutation.isPending}
              onPress={() =>
                reportAttendanceMutation.mutate(
                  { meetupId: entry.meetupId, attended: false },
                  {
                    onSuccess: () =>
                      // #27 — offer to schedule another moment with the same buddy.
                      Alert.alert(
                        "No worries",
                        `Want to set up another moment with ${entry.partner.name}?`,
                        [
                          { text: "Not now", style: "cancel" },
                          {
                            text: "Propose again",
                            onPress: () =>
                              router.push({
                                pathname: "/propose-meetup",
                                params: {
                                  partnerId: entry.partner.id,
                                  partnerName: entry.partner.name,
                                },
                              }),
                          },
                        ],
                      ),
                  },
                )
              }
              className="rounded-full py-3.5 items-center border"
              style={{ borderColor: "#2C1810", opacity: reportAttendanceMutation.isPending ? 0.6 : 1 }}
            >
              <Text className="text-foreground font-semibold">We didn't</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            testID="locked-cta"
            onPress={handleCta}
            className="rounded-full py-3.5 items-center"
            style={{ backgroundColor: "#2C1810" }}
          >
            <Text className="text-background font-semibold">{copy.cta}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Container>
  );
}
