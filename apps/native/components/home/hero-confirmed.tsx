import { Image, Linking, Platform, Pressable, Text, View } from "react-native";

import { GOLD } from "./tokens";
import { formatDayFull, formatTime } from "./format";
import type { ConfirmedMeetup } from "./home-state";

type Props = {
  meetup: ConfirmedMeetup;
  onReschedule: () => void;
  onAcceptReschedule?: () => void;
};

function openDirections(venueName: string) {
  const q = encodeURIComponent(venueName);
  const url = Platform.select({
    ios: `http://maps.apple.com/?q=${q}`,
    android: `geo:0,0?q=${q}`,
    default: `https://www.google.com/maps/search/?api=1&query=${q}`,
  });
  void Linking.openURL(url);
}

export function HeroConfirmed({ meetup, onReschedule, onAcceptReschedule }: Props) {
  const initial = (meetup.partner.name || "?").charAt(0).toUpperCase();
  const dayName = formatDayFull(meetup.scheduledAt).toUpperCase();
  const timeLabel = formatTime(meetup.scheduledAt);

  const rescheduleLabel = meetup.reschedulePending
    ? meetup.rescheduleIsFromMe
      ? "Reschedule pending…"
      : "Answer"
    : "Reschedule";

  const partnerProposedReschedule = meetup.reschedulePending && !meetup.rescheduleIsFromMe;

  return (
    <View>
      <Text
        className="font-manrope-semi tracking-widest text-brand-muted-foreground"
        style={{ fontSize: 12 }}
      >
        YOUR NEXT SIP
      </Text>

      <View
        testID="hero-confirmed"
        className="rounded-3xl mt-3 p-5"
        style={{ backgroundColor: GOLD }}
      >
        <View className="flex-row items-center gap-4">
          <View
            className="items-center justify-center rounded-full overflow-hidden"
            style={{ width: 64, height: 64, backgroundColor: "#E2C5BD" }}
          >
            {meetup.partner.image ? (
              <Image
                source={{ uri: meetup.partner.image }}
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
              {meetup.partner.name}
            </Text>
          </View>
        </View>

        <Text
          className="font-manrope-semi tracking-widest text-brand-foreground mt-6"
          style={{ fontSize: 12 }}
        >
          {dayName}
        </Text>
        <View className="mt-1">
          <Text
            testID="hero-confirmed-time"
            className="text-brand-foreground font-jakarta"
            style={{ fontSize: 56, lineHeight: 60 }}
          >
            {timeLabel}
          </Text>
          <Text
            className="text-brand-foreground font-manrope-bold"
            style={{ fontSize: 14 }}
          >
            {meetup.venue.name}
          </Text>
        </View>

        <View className="flex-row gap-3 mt-5">
          <Pressable
            testID="directions-btn"
            onPress={() => openDirections(meetup.venue.name)}
            className="flex-1 items-center justify-center rounded-full"
            style={{ height: 52, backgroundColor: "#1A1A1A" }}
          >
            <Text className="font-manrope-bold" style={{ fontSize: 16, color: GOLD }}>
              Directions
            </Text>
          </Pressable>
          {partnerProposedReschedule && onAcceptReschedule && (
            <Pressable
              testID="accept-reschedule-btn"
              onPress={onAcceptReschedule}
              className="flex-1 items-center justify-center rounded-full"
              style={{ height: 52, backgroundColor: "#1A1A1A" }}
            >
              <Text className="font-manrope-bold" style={{ fontSize: 14, color: GOLD }}>
                Accept
              </Text>
            </Pressable>
          )}
          <Pressable
            testID="reschedule-btn"
            onPress={onReschedule}
            disabled={meetup.rescheduleIsFromMe && meetup.reschedulePending}
            className="flex-1 items-center justify-center rounded-full"
            style={{
              height: 52,
              borderWidth: 1.5,
              borderColor: "#1A1A1A",
              opacity: meetup.rescheduleIsFromMe && meetup.reschedulePending ? 0.6 : 1,
            }}
          >
            <Text className="font-manrope-bold" style={{ fontSize: 14 }}>
              {rescheduleLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
