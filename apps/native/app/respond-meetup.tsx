import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RespondContent } from "@/components/meetup-flow-modal";

export default function RespondMeetupScreen() {
  const { meetupId } = useLocalSearchParams<{ meetupId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingBottom: insets.bottom }}
    >
      <RespondContent meetupId={meetupId} onDismiss={() => router.back()} />
    </View>
  );
}
