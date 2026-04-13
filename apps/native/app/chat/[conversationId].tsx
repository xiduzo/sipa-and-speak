import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";

import { Container } from "@/components/container";
import { trpc } from "@/utils/trpc";

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const [content, setContent] = useState("");
  const [showEmptyHint, setShowEmptyHint] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

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
      <View className="flex-1" />

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
