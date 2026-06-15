import { Text, View } from "react-native";

import { Container } from "@/components/container";

export default function ConversationStartersScreen() {
  return (
    <Container>
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-center text-lg font-semibold text-foreground">
          Conversation Starters
        </Text>
        <Text className="mt-2 text-center text-sm text-muted-foreground">
          Your practice cards will appear here.
        </Text>
      </View>
    </Container>
  );
}
