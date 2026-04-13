import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "heroui-native";
import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Container } from "@/components/container";
import { trpc } from "@/utils/trpc";

const DETAIL_MAX = 450;

const REASONS = [
  ["OFFENSIVE_LANGUAGE", "Offensive language"],
  ["HARASSMENT", "Harassment"],
  ["SPAM", "Spam"],
  ["INAPPROPRIATE_BEHAVIOR", "Inappropriate behaviour"],
  ["OTHER", "Other"],
] as const;

type FlagReason = (typeof REASONS)[number][0];

export default function FlagUserScreen() {
  const { targetId, targetName } = useLocalSearchParams<{
    targetId: string;
    targetName: string;
  }>();
  const router = useRouter();

  const [selectedReason, setSelectedReason] = useState<FlagReason | null>(null);
  const [detail, setDetail] = useState("");
  const [noReasonError, setNoReasonError] = useState(false);

  const flagMutation = useMutation(
    trpc.moderation.flagStudent.mutationOptions({
      onSuccess: () => {
        Alert.alert(
          "Report submitted",
          "Thank you. A Moderator will review your report.",
        );
        router.back();
      },
      onError: (err) => {
        Alert.alert("Something went wrong", err.message);
      },
    }),
  );

  const detailTooLong = detail.length > DETAIL_MAX;
  const isDisabled = flagMutation.isPending || detailTooLong;

  function handleSubmit() {
    if (!selectedReason) {
      setNoReasonError(true);
      return;
    }
    setNoReasonError(false);
    if (!targetId) return;
    flagMutation.mutate({
      targetId,
      reason: selectedReason,
      detail: detail.trim() || undefined,
    });
  }

  return (
    <Container>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-foreground text-2xl font-bold mb-2">
          Report {targetName ?? "Student"}
        </Text>
        <Text className="text-muted-foreground text-sm mb-6">
          Select a reason for reporting this Student. A Moderator will review your report.
        </Text>

        <Text className="text-foreground font-semibold mb-3">Reason</Text>
        <View className="flex flex-col gap-2 mb-4">
          {REASONS.map(([key, label]) => (
            <TouchableOpacity
              key={key}
              testID={`reason-${key}`}
              onPress={() => {
                setSelectedReason(key);
                setNoReasonError(false);
              }}
              className={`border rounded-xl p-3 ${
                selectedReason === key
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card"
              }`}
            >
              <Text
                className={`font-medium ${
                  selectedReason === key ? "text-primary" : "text-foreground"
                }`}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {noReasonError && (
          <Text testID="no-reason-error" className="text-destructive text-sm mb-4">
            Please select a reason before submitting.
          </Text>
        )}

        <Text className="text-foreground font-semibold mb-2">
          Additional detail (optional)
        </Text>
        <TextInput
          testID="flag-detail-input"
          value={detail}
          onChangeText={setDetail}
          placeholder="Describe what happened…"
          multiline
          numberOfLines={4}
          maxLength={DETAIL_MAX + 10}
          className="border border-border rounded-xl px-3 py-2 text-foreground bg-card mb-1"
          placeholderTextColor="#888"
        />
        <Text
          testID={detailTooLong ? "char-count-warning" : "char-count"}
          className={`text-xs mb-4 text-right ${
            detailTooLong ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {detail.length}/{DETAIL_MAX}
          {detailTooLong ? " — too long" : ""}
        </Text>

        <Button
          testID="flag-submit-btn"
          onPress={handleSubmit}
          isDisabled={isDisabled}
        >
          <Button.Label>
            {flagMutation.isPending ? "Submitting…" : "Submit report"}
          </Button.Label>
        </Button>
      </ScrollView>
    </Container>
  );
}
