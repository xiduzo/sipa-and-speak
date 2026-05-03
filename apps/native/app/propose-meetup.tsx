import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProposeContent } from "@/components/meetup-flow-modal";

export default function ProposeMeetupScreen() {
  const { partnerId, partnerName } = useLocalSearchParams<{
    partnerId: string;
    partnerName: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-background"
      style={{ flex: 1, paddingBottom: insets.bottom }}
    >
      <ProposeContent
        partnerId={partnerId ?? ""}
        partnerName={partnerName ?? "partner"}
        onDismiss={() => router.back()}
      />
    </View>
  );
}
