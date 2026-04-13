import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Container } from "@/components/container";

export default function ChatsScreen() {
  const router = useRouter();
  const { data: conversations = [], isLoading } = useQuery(
    trpc.chat.listConversations.queryOptions(),
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

  return (
    <Container isScrollable={false}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`conversation-entry-${item.id}`}
            className="flex-row items-center px-4 py-3 border-b border-border"
            onPress={() => router.push(`/chat/${item.id}`)}
          >
            <View className="flex-1">
              <Text className="text-foreground font-semibold">
                {item.partner?.name ?? "Unknown"}
              </Text>
            </View>
            {item.hasUnread && (
              <View
                testID={`unread-indicator-${item.id}`}
                className="w-2.5 h-2.5 rounded-full bg-primary"
              />
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View
            testID="empty-inbox"
            className="flex-1 items-center justify-center p-6 mt-24"
          >
            <Text className="text-foreground text-xl font-bold mb-2">No conversations yet</Text>
            <Text className="text-muted-foreground text-center">
              Once you connect with a match, your conversations will appear here.
            </Text>
          </View>
        }
      />
    </Container>
  );
}
