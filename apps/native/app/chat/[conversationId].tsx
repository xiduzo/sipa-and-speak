import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { differenceInCalendarDays, format, startOfDay as dfStartOfDay } from "date-fns";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "HH:mm");
}

function startOfDay(d: Date): number {
  return dfStartOfDay(d).getTime();
}

function formatDayLabel(date: Date): string {
  const diffDays = differenceInCalendarDays(new Date(), date);
  if (diffDays === 0) return "TODAY";
  if (diffDays === 1) return "YESTERDAY";
  if (diffDays < 7) return format(date, "EEEE").toUpperCase();
  return format(date, "MMM d").toUpperCase();
}

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: Date | string;
  isUnread: boolean;
};

type Row =
  | { kind: "divider"; id: string; label: string }
  | { kind: "message"; id: string; message: Message };

function buildRows(messages: Message[]): Row[] {
  const rows: Row[] = [];
  let lastDay: number | null = null;
  for (const m of messages) {
    const d = typeof m.createdAt === "string" ? new Date(m.createdAt) : m.createdAt;
    const day = startOfDay(d);
    if (day !== lastDay) {
      rows.push({ kind: "divider", id: `div-${day}`, label: formatDayLabel(d) });
      lastDay = day;
    }
    rows.push({ kind: "message", id: m.id, message: m });
  }
  return rows;
}

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user.id;

  const [content, setContent] = useState("");
  const [showEmptyHint, setShowEmptyHint] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const queryClient = useQueryClient();

  const markRead = useMutation(trpc.chat.markRead.mutationOptions());
  const setPresence = useMutation(trpc.messaging.setPresence.mutationOptions());

  useFocusEffect(
    useCallback(() => {
      markRead.mutate(
        { conversationId },
        {
          onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["chat.getMessages"] });
          },
        },
      );

      setPresence.mutate({ conversationId, active: true });

      const appStateSub = AppState.addEventListener("change", (nextState) => {
        if (nextState === "background" || nextState === "inactive") {
          setPresence.mutate({ conversationId, active: false });
        } else if (nextState === "active") {
          setPresence.mutate({ conversationId, active: true });
        }
      });

      return () => {
        setPresence.mutate({ conversationId, active: false });
        appStateSub.remove();
      };
    }, [conversationId]),
  );

  const { data } = useQuery(
    trpc.chat.getMessages.queryOptions(
      { conversationId },
      { refetchInterval: 5000 },
    ),
  );

  const { data: entries } = useQuery(trpc.chat.listEntries.queryOptions());
  const partner = useMemo(() => {
    const entry = entries?.find(
      (e) => e.kind === "open" && e.id === conversationId,
    );
    if (entry && entry.kind === "open") return entry.partner;
    return null;
  }, [entries, conversationId]);

  const messages = (data?.messages ?? []) as Message[];
  const rows = useMemo(() => buildRows(messages), [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: false });
    }
  }, [messages.length]);

  const sendMessage = useMutation(
    trpc.messaging.sendMessage.mutationOptions({
      onSuccess: () => {
        setContent("");
        setSendError(null);
      },
      onError: (err) => setSendError(err.message),
    }),
  );

  function handleSend() {
    if (!content.trim()) {
      setShowEmptyHint(true);
      return;
    }
    setShowEmptyHint(false);
    setSendError(null);
    sendMessage.mutate({ conversationId, content: content.trim() });
  }

  function handleChangeText(text: string) {
    setContent(text);
    if (text.trim()) setShowEmptyHint(false);
  }

  const isPending = sendMessage.isPending;
  const partnerInitial = (partner?.name?.trim()?.[0] ?? "?").toUpperCase();

  return (
    <View className="flex-1 bg-brand-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-3 gap-3">
        <TouchableOpacity
          testID="chat-back-btn"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={24} color="#2C1810" />
        </TouchableOpacity>
        <View className="w-11 h-11 rounded-full bg-brand-muted items-center justify-center overflow-hidden">
          {partner?.image ? (
            <Image
              source={{ uri: partner.image }}
              className="w-11 h-11 rounded-full"
            />
          ) : (
            <Text className="text-brand-foreground font-manrope-bold text-lg">
              {partnerInitial}
            </Text>
          )}
        </View>
        <View className="flex-1">
          <Text className="text-brand-foreground font-manrope-bold text-base">
            {partner?.name ?? "Chat"}
          </Text>
          <View className="flex-row items-center gap-1.5 mt-0.5">
            <View className="w-1.5 h-1.5 rounded-full bg-brand-green" />
            <Text className="text-brand-muted-foreground font-manrope text-xs">
              open chat
            </Text>
          </View>
        </View>
        <TouchableOpacity
          testID="chat-info-btn"
          accessibilityLabel="Conversation info"
          hitSlop={12}
        >
          <Ionicons name="information-circle-outline" size={24} color="#6F605B" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 8 : 0}
      >
        <FlatList
          ref={listRef}
          testID="message-list"
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 8 }}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
          ListEmptyComponent={
            <View
              testID="empty-conversation-state"
              className="flex-1 items-center justify-center py-16 px-8"
            >
              <Text className="text-brand-muted-foreground font-manrope text-center text-base">
                No messages yet. Say hi to start the conversation!
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.kind === "divider") {
              return (
                <View className="items-center my-3">
                  <Text className="text-brand-muted-foreground font-manrope-semi tracking-widest text-[11px]">
                    {item.label}
                  </Text>
                </View>
              );
            }
            const msg = item.message;
            const isMine = msg.senderId === currentUserId;
            return (
              <View
                testID="message-bubble"
                className={`mx-4 my-1 max-w-[78%] rounded-3xl px-4 py-2.5 ${
                  isMine
                    ? "self-end bg-brand-gold"
                    : "self-start bg-brand-muted"
                }`}
              >
                {!isMine && (
                  <Text
                    testID="message-sender"
                    className="text-brand-muted-foreground font-manrope text-[11px] mb-0.5"
                  >
                    {partner?.name ?? "Match"}
                  </Text>
                )}
                <Text
                  className={`font-manrope text-brand-foreground ${
                    msg.isUnread && !isMine ? "font-manrope-semi" : ""
                  }`}
                >
                  {msg.content}
                </Text>
                <View className="flex-row items-center justify-end gap-1 mt-0.5">
                  {msg.isUnread && !isMine && (
                    <View
                      testID="unread-indicator"
                      className="w-1.5 h-1.5 rounded-full bg-brand-primary"
                    />
                  )}
                  <Text
                    testID="message-timestamp"
                    className="text-brand-foreground/50 font-manrope text-[10px]"
                  >
                    {formatTime(msg.createdAt)}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View
          className="px-4 pt-2 gap-2"
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          {showEmptyHint && (
            <Text testID="empty-hint" className="text-red-500 font-manrope text-sm">
              Message cannot be empty.
            </Text>
          )}
          {sendError && (
            <Text className="text-red-500 font-manrope text-sm">{sendError}</Text>
          )}
          <View className="flex-row items-center gap-2">
            <View className="flex-1 rounded-full bg-white border border-brand-border px-5 py-1">
              <TextInput
                testID="message-input"
                className="text-brand-foreground font-manrope text-base py-2"
                placeholder="Type a message…"
                placeholderTextColor="#6F605B"
                multiline
                value={content}
                onChangeText={handleChangeText}
                editable={!isPending}
                accessibilityLabel="Message input"
              />
            </View>
            <TouchableOpacity
              testID="send-btn"
              onPress={handleSend}
              disabled={isPending}
              accessibilityState={{ disabled: isPending }}
              accessibilityLabel="Send message"
              className="w-12 h-12 rounded-full bg-brand-gold items-center justify-center"
            >
              <Ionicons name="arrow-up" size={22} color="#2C1810" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
