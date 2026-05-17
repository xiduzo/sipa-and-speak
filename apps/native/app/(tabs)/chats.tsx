import { FlatList, Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { differenceInCalendarDays, format, isSameDay, isYesterday } from "date-fns";

import { trpc } from "@/utils/trpc";
import { Container } from "@/components/container";
import { CARD, GOLD } from "@/components/home/tokens";

const DARK = "#1A1A1A";
const MUTED = "#8A7570";
const LOCKED_TINT = "#A8635A";
const DIVIDER = "#EFE7DD";

const AVATAR_PALETTE = [
  "#E8B5AA", // rose
  "#B5CFC6", // sage
  "#D4B59E", // peach
  "#D6B7C2", // mauve
  "#E6D4B8", // sand
  "#C9D5C0", // moss
  "#E2C5B0", // clay
];

function avatarTone(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) % 4096;
  }
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

function formatChatTime(input: string | Date): string {
  const at = input instanceof Date ? input : new Date(input);
  const now = new Date();
  if (now.getTime() - at.getTime() < 60_000) return "just now";
  if (isSameDay(at, now)) return format(at, "HH:mm");
  if (isYesterday(at)) return "Yesterday";
  if (differenceInCalendarDays(now, at) < 7) return format(at, "EEE");
  return format(at, "MMM d");
}

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
      return `unlocks ${formatUnlock(at)}`;
    case "awaiting_attendance":
      return "did you meet?";
    case "awaiting_my_optin":
      return "tap to keep in touch";
    case "awaiting_partner_optin":
      return `waiting on ${entry.partner.name.split(" ")[0]}`;
    case "declined":
      return "chat won't open";
  }
}

function formatUnlock(at: Date): string {
  const now = new Date();
  const days = differenceInCalendarDays(at, now);
  const time = format(at, "HH:mm");
  if (days <= 0) return `today ${time}`;
  if (days === 1) return `tomorrow ${time}`;
  if (days < 7) return `${format(at, "EEEE")} ${time}`;
  return format(at, "MMM d");
}

function Avatar({
  name,
  image,
  locked,
}: {
  name: string;
  image: string | null;
  locked?: boolean;
}) {
  const tone = avatarTone(name);
  return (
    <View style={{ width: 52, height: 52, marginRight: 14 }}>
      <View
        className="items-center justify-center rounded-full"
        style={{
          width: 52,
          height: 52,
          backgroundColor: tone,
          opacity: locked ? 0.85 : 1,
        }}
      >
        {image ? (
          <Image
            source={{ uri: image }}
            style={{ width: 52, height: 52, borderRadius: 26 }}
          />
        ) : (
          <Text
            className="font-jakarta"
            style={{ fontSize: 20, color: DARK }}
          >
            {initials(name)}
          </Text>
        )}
      </View>
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
      <Avatar name={name} image={entry.partner?.image ?? null} />
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
      <Avatar name={entry.partner.name} image={entry.partner.image} locked />
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
          {lockedSubtitle(entry)}
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
  const openCount = list.filter((e) => e.kind === "open").length;
  const lockedCount = list.filter((e) => e.kind === "locked").length;

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
