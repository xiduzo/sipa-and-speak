import { Text, View } from "react-native";

import { Container } from "@/components/container";

export default function ChatsScreen() {
  return (
    <Container isScrollable={false}>
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-foreground text-2xl font-bold mb-2">Chats</Text>
        <Text className="text-muted-foreground text-center">
          Your conversations will appear here.
        </Text>
      </View>
    </Container>
  );
}
