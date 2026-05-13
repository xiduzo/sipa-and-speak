import { FlatList, Image, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/utils/trpc";
import { Container } from "@/components/container";

type ChatEntry =
  | {
      kind: "open";
      id: string;
      conversationId: string;
      meetupId: string | null;
      partner: { id: string; name: string; image: string | null } | null;
      lastMessage: { content: string; createdAt: string | Date } | null;
      hasUnread: boolean;
    }
  | {
      kind: "locked";
      id: string;
      meetupId: string;
      partner: { id: string; name: string; image: string | null };
      venue: { id: string; name: string; photoUrl: string | null };
      meetupAt: string;
      phase:
        | "scheduled"
        | "awaiting_attendance"
        | "awaiting_my_optin"
        | "awaiting_partner_optin"
        | "declined";
    };

function lockedSubtitle(entry: Extract<ChatEntry, { kind: "locked" }>): string {
  const at = new Date(entry.meetupAt);
  switch (entry.phase) {
    case "scheduled":
      return `locked · unlocks ${formatUnlock(at)}`;
    case "awaiting_attendance":
      return "locked · did you meet?";
    case "awaiting_my_optin":
      return "locked · tap to keep in touch";
    case "awaiting_partner_optin":
      return `locked · waiting on ${entry.partner.name.split(" ")[0]}`;
    case "declined":
      return "chat won't open";
  }
}

function formatUnlock(at: Date): string {
  const now = new Date();
  const diffMs = at.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const time = at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays < 1) return `today ${time}`;
  if (diffDays < 2) return `tomorrow ${time}`;
  if (diffDays < 7) {
    const weekday = at.toLocaleDateString([], { weekday: "long" });
    return `${weekday} ${time}`;
  }
  return at.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ChatsScreen() {
  const router = useRouter();
  const { data: entries = [], isLoading } = useQuery(
    trpc.chat.listEntries.queryOptions(),
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
        data={entries as ChatEntry[]}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        renderItem={({ item }) => {
          if (item.kind === "locked") {
            return (
              <TouchableOpacity
                testID={`locked-entry-${item.meetupId}`}
                accessibilityLabel={`Locked chat with ${item.partner.name}`}
                className="flex-row items-center px-4 py-3 border-b border-border"
                onPress={() =>
                  router.push(`/chat/locked/${item.meetupId}`)
                }
              >
                <View className="w-10 h-10 rounded-full bg-muted items-center justify-center mr-3 overflow-hidden">
                  {item.partner.image ? (
                    <Image
                      source={{ uri: item.partner.image }}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <Ionicons name="lock-closed" size={18} color="#6b7280" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-foreground font-semibold">
                    {item.partner.name}
                  </Text>
                  <Text
                    testID={`locked-subtitle-${item.meetupId}`}
                    className="text-muted-foreground text-xs mt-0.5"
                  >
                    {lockedSubtitle(item)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              testID={`conversation-entry-${item.id}`}
              className="flex-row items-center px-4 py-3 border-b border-border"
              onPress={() => router.push(`/chat/${item.id}`)}
            >
              <View className="w-10 h-10 rounded-full bg-muted items-center justify-center mr-3 overflow-hidden">
                {item.partner?.image ? (
                  <Image
                    source={{ uri: item.partner.image }}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <Ionicons name="person" size={18} color="#6b7280" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-semibold">
                  {item.partner?.name ?? "Unknown"}
                </Text>
                {item.lastMessage && (
                  <Text
                    numberOfLines={1}
                    className="text-muted-foreground text-xs mt-0.5"
                  >
                    {item.lastMessage.content}
                  </Text>
                )}
              </View>
              {item.hasUnread && (
                <View
                  testID={`unread-indicator-${item.id}`}
                  className="w-2.5 h-2.5 rounded-full bg-primary"
                />
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View
            testID="empty-inbox"
            className="flex-1 items-center justify-center p-6 mt-24"
          >
            <Text className="text-foreground text-xl font-bold mb-2">
              No conversations yet
            </Text>
            <Text className="text-muted-foreground text-center">
              When you confirm a meetup with a match, their chat will appear here — locked until you both meet and opt in.
            </Text>
          </View>
        }
      />
    </Container>
  );
}
