import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button, Spinner } from "heroui-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { trpc } from "@/utils/trpc";
import { Avatar } from "@/components/avatar";
import { profileSections } from "@/utils/profile-presentation";
import { getLanguageFlag } from "@/utils/language-flags";

const GOLD = "#F2C94C";

interface CandidateCardProps {
  userId: string;
  name: string;
  image: string | null;
  spokenLanguages: { language: string; proficiency: string | null }[];
  learningLanguages: string[];
  interests: string[];
  compatibleLanguages?: string[];
}

export function CandidateCard({
  userId,
  name,
  image,
  spokenLanguages,
  learningLanguages,
  interests,
  compatibleLanguages,
}: CandidateCardProps) {
  const router = useRouter();
  const [sendConflictError, setSendConflictError] = useState<string | null>(null);
  const sendRequestMutation = useMutation({
    ...trpc.matching.sendMatchRequest.mutationOptions(),
    onError: (error) => {
      if (error.data?.code === "CONFLICT") {
        setSendConflictError("A match request to this candidate already exists.");
      }
    },
  });

  const sections = profileSections({
    spokenLanguages,
    learningLanguages,
    interests,
  });

  function handlePress() {
    router.push(`/partner/${userId}` as never);
  }

  return (
    <Pressable
      testID="candidate-card"
      onPress={handlePress}
      className="bg-card border border-border rounded-2xl p-4 mb-3 active:opacity-70"
    >
      <View className="flex-row items-center gap-3 mb-3">
        <Avatar
          name={name}
          image={image}
          size={56}
          single
          tone={null}
          className="bg-muted"
          textClassName="text-muted-foreground text-xl font-semibold"
          imageTestID="candidate-photo"
          placeholderTestID="candidate-photo-placeholder"
        />
        <Text testID="candidate-name" className="text-foreground text-lg font-semibold flex-1">
          {name}
        </Text>
      </View>

      {sections.speaks.items.length > 0 && (
        <View className="mb-2">
          <Text className="text-muted-foreground text-xs uppercase font-medium mb-1">
            {sections.speaks.title}
          </Text>
          <View className="flex-row flex-wrap gap-1" testID="candidate-offered-languages">
            {sections.speaks.items.map((item) => (
              <View key={item.value} className="bg-primary/10 px-2 py-0.5 rounded-full">
                <Text className="text-primary text-xs">{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {sections.learning.items.length > 0 && (
        <View className="mb-2">
          <Text className="text-muted-foreground text-xs uppercase font-medium mb-1">
            {sections.learning.title}
          </Text>
          <View className="flex-row flex-wrap gap-1" testID="candidate-targeted-languages">
            {sections.learning.items.map((item) => (
              <View key={item.value} className="bg-secondary/10 px-2 py-0.5 rounded-full">
                <Text className="text-secondary-foreground text-xs">{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {(compatibleLanguages ?? []).length > 0 && (
        <View className="mb-2">
          <Text className="text-muted-foreground text-xs uppercase font-medium mb-1">
            In common
          </Text>
          <View className="flex-row flex-wrap gap-1" testID="candidate-compatible-languages">
            {(compatibleLanguages ?? []).map((lang) => (
              <View key={lang} className="px-2 py-0.5 rounded-full" style={{ backgroundColor: GOLD }}>
                <Text className="text-xs font-semibold" style={{ color: "#2C1810" }}>
                  {getLanguageFlag(lang)} {lang}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {sections.topics.items.length > 0 && (
        <View className="mb-3">
          <Text className="text-muted-foreground text-xs uppercase font-medium mb-1">
            {sections.topics.title}
          </Text>
          <View className="flex-row flex-wrap gap-1" testID="candidate-conversation-topics">
            {sections.topics.items.map((item) => (
              <View key={item.value} className="bg-muted px-2 py-0.5 rounded-full">
                <Text className="text-muted-foreground text-xs">{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* #124 — Confirmation feedback */}
      {sendRequestMutation.isSuccess && (
        <View testID="confirmation-message" className="bg-primary/10 rounded-xl p-2 mb-2">
          <Text className="text-primary text-xs text-center">
            Request sent! We'll let you know when they respond.
          </Text>
        </View>
      )}

      {/* #123 — Conflict error */}
      {sendConflictError && (
        <View testID="conflict-error-message" className="bg-danger/10 rounded-xl p-2 mb-2">
          <Text className="text-danger text-xs text-center">{sendConflictError}</Text>
        </View>
      )}

      {/* #122 — Send Request quick action */}
      <Button
        testID="send-request-button"
        variant="primary"
        isDisabled={sendRequestMutation.isPending || sendRequestMutation.isSuccess}
        onPress={() => sendRequestMutation.mutate({ receiverId: userId })}
      >
        {sendRequestMutation.isPending ? (
          <Spinner size="sm" />
        ) : (
          <Button.Label>
            {sendRequestMutation.isSuccess ? "Request Sent" : "Send Request"}
          </Button.Label>
        )}
      </Button>
    </Pressable>
  );
}
