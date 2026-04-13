import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, FlatList, Text, TextInput, TouchableOpacity, View } from "react-native";

import { authClient } from "@/lib/auth-client";
import { Container } from "@/components/container";
import { trpc } from "@/utils/trpc";

function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user.id;

  const [content, setContent] = useState("");
  const [showEmptyHint, setShowEmptyHint] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const queryClient = useQueryClient();

  const markRead = useMutation(
    trpc.chat.markRead.mutationOptions(),
  );

  const setPresence = useMutation(
    trpc.messaging.setPresence.mutationOptions(),
  );

  useFocusEffect(
    useCallback(() => {
      markRead.mutate(
        { conversationId },
        {
          onSuccess: () => {
            // Invalidate getMessages so isUnread indicators refresh
            void queryClient.invalidateQueries({ queryKey: ["chat.getMessages"] });
          },
        },
      );

      // #153 — Signal active presence so push notifications are suppressed while viewing
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

  const messages = data?.messages ?? [];

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

  return (
    <Container isScrollable={false}>
      <FlatList
        ref={listRef}
        testID="message-list"
        data={messages}
        keyExtractor={(item) => item.id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View testID="empty-conversation-state" className="flex-1 items-center justify-center py-16 px-8">
            <Text className="text-muted-foreground text-center text-base">
              No messages yet. Say hi to start the conversation!
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isMine = item.senderId === currentUserId;
          return (
            <View
              testID="message-bubble"
              className={`mx-4 my-1 max-w-[80%] rounded-2xl px-3 py-2 ${isMine ? "self-end bg-primary" : item.isUnread ? "self-start bg-muted border-l-2 border-primary" : "self-start bg-muted"}`}
            >
              {!isMine && (
                <Text testID="message-sender" className="text-xs text-muted-foreground mb-1">
                  Match
                </Text>
              )}
              <Text
                className={`${isMine ? "text-primary-foreground" : "text-foreground"} ${item.isUnread && !isMine ? "font-semibold" : ""}`}
              >
                {item.content}
              </Text>
              <View className="flex-row items-center justify-end gap-1 mt-1">
                {item.isUnread && !isMine && (
                  <View
                    testID="unread-indicator"
                    className="w-2 h-2 rounded-full bg-primary"
                  />
                )}
                <Text
                  testID="message-timestamp"
                  className={`text-xs ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                >
                  {formatTime(item.createdAt)}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View className="border-t border-border px-4 py-3 gap-2">
        {showEmptyHint && (
          <Text testID="empty-hint" className="text-danger text-sm">
            Message cannot be empty.
          </Text>
        )}
        {sendError && (
          <Text className="text-danger text-sm">{sendError}</Text>
        )}
        <View className="flex-row items-end gap-2">
          <TextInput
            testID="message-input"
            className="flex-1 border border-border rounded-xl px-3 py-2 text-foreground bg-background"
            placeholder="Type a message…"
            placeholderTextColor="gray"
            multiline
            value={content}
            onChangeText={handleChangeText}
            editable={!isPending}
            accessibilityLabel="Message input"
          />
          <TouchableOpacity
            testID="send-btn"
            onPress={handleSend}
            disabled={isPending}
            accessibilityState={{ disabled: isPending }}
            className="bg-primary rounded-xl px-4 py-2 justify-center"
          >
            <Text className="text-primary-foreground font-semibold">Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Container>
  );
}
