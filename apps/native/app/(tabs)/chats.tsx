import { FlatList, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { formatChatTimestamp } from "@/lib/dates";
import { trpc } from "@/utils/trpc";
import { Avatar } from "@/components/avatar";
import { Container } from "@/components/container";
import { CARD, GOLD } from "@/components/home/tokens";
import {
  type ChatEntry,
  chatListCounts,
  conversationSubtitle,
} from "@/utils/chat-list";

const DARK = "#1A1A1A";
const MUTED = "#8A7570";
const LOCKED_TINT = "#A8635A";
const DIVIDER = "#EFE7DD";

function formatChatTime(input: string | Date): string {
  return formatChatTimestamp(input);
}

function ChatAvatar({
  name,
  image,
  locked,
}: {
  name: string;
  image: string | null;
  locked?: boolean;
}) {
  return (
    <View style={{ width: 52, height: 52, marginRight: 14 }}>
      <Avatar
        name={name}
        image={image}
        size={52}
        fontSize={20}
        color={DARK}
        opacity={locked ? 0.85 : 1}
      />
      {locked && (
        <View
          className="items-center justify-center rounded-full"
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: GOLD,
            borderWidth: 2,
            borderColor: "#FAF6F1",
          }}
        >
          <Ionicons name="lock-closed" size={11} color={DARK} />
        </View>
      )}
    </View>
  );
}

function HeaderBlock({
  openCount,
  lockedCount,
}: {
  openCount: number;
  lockedCount: number;
}) {
  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 18 }}>
      <Text
        className="font-jakarta"
        style={{ fontSize: 42, lineHeight: 46, color: DARK, letterSpacing: -0.5 }}
      >
        Chats
      </Text>
      <View className="flex-row items-center" style={{ gap: 8, marginTop: 4 }}>
        <Text className="font-manrope" style={{ fontSize: 14, color: MUTED }}>
          {openCount} open
        </Text>
        {lockedCount > 0 && (
          <>
            <Text className="font-manrope" style={{ fontSize: 14, color: MUTED }}>
              ·
            </Text>
            <Text
              className="font-manrope-semi"
              style={{ fontSize: 14, color: LOCKED_TINT }}
            >
              {lockedCount} locked
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

function OpenRow({
  entry,
  onPress,
}: {
  entry: Extract<ChatEntry, { kind: "open" }>;
  onPress: () => void;
}) {
  const name = entry.partner?.name ?? "Unknown";
  const preview = entry.lastMessage?.content;
  const timestamp = entry.lastMessage?.createdAt;

  return (
    <Pressable
      testID={`conversation-entry-${entry.id}`}
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.04)" }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingVertical: 14,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <ChatAvatar name={name} image={entry.partner?.image ?? null} />
      <View style={{ flex: 1, marginRight: 10 }}>
        <Text
          className="font-jakarta"
          style={{ fontSize: 17, color: DARK }}
          numberOfLines={1}
        >
          {name}
        </Text>
        {preview ? (
          <Text
            className="font-manrope"
            style={{ fontSize: 14, color: MUTED, marginTop: 2 }}
            numberOfLines={1}
          >
            {preview}
          </Text>
        ) : (
          <Text
            className="font-manrope"
            style={{
              fontSize: 14,
              color: MUTED,
              marginTop: 2,
              fontStyle: "italic",
            }}
            numberOfLines={1}
          >
            say hi first
          </Text>
        )}
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        {timestamp && (
          <Text
            className="font-manrope"
            style={{
              fontSize: 12,
              color: entry.hasUnread ? DARK : MUTED,
            }}
          >
            {formatChatTime(timestamp)}
          </Text>
        )}
        {entry.hasUnread && (
          <View
            testID={`unread-indicator-${entry.id}`}
            className="items-center justify-center rounded-full"
            style={{
              minWidth: 22,
              height: 22,
              paddingHorizontal: 7,
              backgroundColor: GOLD,
            }}
          >
            <Text
              className="font-manrope-bold"
              style={{ fontSize: 11, color: DARK, lineHeight: 14 }}
            >
              •
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function LockedRow({
  entry,
  onPress,
}: {
  entry: Extract<ChatEntry, { kind: "locked" }>;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={`locked-entry-${entry.meetupId}`}
      accessibilityLabel={`Locked chat with ${entry.partner.name}`}
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.04)" }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingVertical: 14,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <ChatAvatar name={entry.partner.name} image={entry.partner.image} locked />
      <View style={{ flex: 1 }}>
        <Text
          className="font-jakarta"
          style={{ fontSize: 17, color: MUTED }}
          numberOfLines={1}
        >
          {entry.partner.name}
        </Text>
        <Text
          testID={`locked-subtitle-${entry.meetupId}`}
          className="font-manrope"
          style={{
            fontSize: 13,
            color: MUTED,
            marginTop: 2,
            fontStyle: "italic",
          }}
          numberOfLines={1}
        >
          {conversationSubtitle(entry.phase, entry.partner.name)}
        </Text>
      </View>
    </Pressable>
  );
}

function Divider() {
  return (
    <View
      style={{
        height: 1,
        marginLeft: 24 + 52 + 14,
        marginRight: 24,
        backgroundColor: DIVIDER,
      }}
    />
  );
}

export default function ChatsScreen() {
  const router = useRouter();
  const { data: entries = [], isLoading } = useQuery(
    trpc.chat.listEntries.queryOptions(),
  );

  if (isLoading) {
    return (
      <Container isScrollable={false}>
        <HeaderBlock openCount={0} lockedCount={0} />
        <View className="flex-1 items-center justify-center">
          <Text className="font-manrope" style={{ color: MUTED }}>
            Loading…
          </Text>
        </View>
      </Container>
    );
  }

  const list = entries as ChatEntry[];
  const { openCount, lockedCount } = chatListCounts(list);

  return (
    <Container isScrollable={false}>
      <FlatList
        data={list}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        ListHeaderComponent={
          list.length === 0 ? null : (
            <HeaderBlock openCount={openCount} lockedCount={lockedCount} />
          )
        }
        ItemSeparatorComponent={Divider}
        renderItem={({ item }) => {
          if (item.kind === "locked") {
            return (
              <LockedRow
                entry={item}
                onPress={() => router.push(`/chat/locked/${item.meetupId}`)}
              />
            );
          }
          return (
            <OpenRow
              entry={item}
              onPress={() => router.push(`/chat/${item.id}`)}
            />
          );
        }}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={
          <View
            testID="empty-inbox"
            className="flex-1 items-center px-8"
            style={{ paddingTop: 96 }}
          >
            <View
              className="items-center justify-center rounded-full mb-6"
              style={{ width: 72, height: 72, backgroundColor: CARD }}
            >
              <Text style={{ fontSize: 32 }}>☕</Text>
            </View>
            <Text
              className="font-jakarta text-center mb-2"
              style={{ fontSize: 24, color: DARK }}
            >
              No conversations yet
            </Text>
            <Text
              className="font-manrope text-center"
              style={{ fontSize: 14, color: MUTED, lineHeight: 20 }}
            >
              When you confirm a meetup with a match, their chat will appear here — locked until you both meet and opt in.
            </Text>
          </View>
        }
      />
    </Container>
  );
}
