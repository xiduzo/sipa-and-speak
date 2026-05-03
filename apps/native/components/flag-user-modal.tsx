import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { trpc } from "@/utils/trpc";

const WARM_BROWN = "#2C1810";
const MUTED = "#8A7570";
const CARD_BG = "#EDE5DC";
const BORDER = "#D9C9BC";
const BG = "#F5EFE8";

const DETAIL_MAX = 450;

const REASONS = [
  { key: "OFFENSIVE_LANGUAGE" as const, label: "They didn't show up", emoji: "⏰" },
  { key: "INAPPROPRIATE_BEHAVIOR" as const, label: "Behaviour made me uncomfortable", emoji: "⚠️" },
  { key: "SPAM" as const, label: "Profile seems fake", emoji: "🎭" },
  { key: "HARASSMENT" as const, label: "Pushed beyond language exchange", emoji: "✋" },
  { key: "OTHER" as const, label: "Something else", isText: true },
] as const;

type FlagReason = (typeof REASONS)[number]["key"];

interface Props {
  visible: boolean;
  targetId: string;
  targetName: string;
  onDismiss: () => void;
}

export function FlagUserModal({ visible, targetId, targetName, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const [selectedReason, setSelectedReason] = useState<FlagReason | null>(null);
  const [detail, setDetail] = useState("");
  const [noReasonError, setNoReasonError] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const detailTooLong = detail.length > DETAIL_MAX;

  const flagMutation = useMutation(
    trpc.moderation.flagStudent.mutationOptions({
      onSuccess: () => setSubmitted(true),
      onError: (err) => setSubmitError(err.message),
    }),
  );

  function handleReset() {
    setSelectedReason(null);
    setDetail("");
    setNoReasonError(false);
    setSubmitted(false);
    setSubmitError(null);
  }

  function handleDismiss() {
    handleReset();
    onDismiss();
  }

  function handleContinue() {
    if (!selectedReason) {
      setNoReasonError(true);
      return;
    }
    setNoReasonError(false);
    flagMutation.mutate({
      targetId,
      reason: selectedReason,
      detail: detail.trim() || undefined,
    });
  }

  const isDisabled = flagMutation.isPending || detailTooLong;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleDismiss}
    >
      <View style={{ flex: 1, backgroundColor: BG }}>
        {submitted ? (
          <View testID="flag-confirmation" style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingBottom: insets.bottom }}>
            <Text style={{ fontFamily: "Caveat_700Bold", fontSize: 36, color: WARM_BROWN, textAlign: "center", marginBottom: 12 }}>
              Report submitted
            </Text>
            <Text style={{ fontFamily: "Manrope_400Regular", fontSize: 15, color: MUTED, textAlign: "center", lineHeight: 22, marginBottom: 40 }}>
              A Moderator will review your report within 24h. They won't know you reported.
            </Text>
            <Pressable
              testID="flag-confirmation-done"
              onPress={handleDismiss}
              style={({ pressed }) => ({
                backgroundColor: pressed ? "#3d2318" : WARM_BROWN,
                borderRadius: 100,
                paddingVertical: 16,
                paddingHorizontal: 48,
              })}
            >
              <Text style={{ fontFamily: "Manrope_700Bold", fontSize: 16, color: BG, letterSpacing: 0.3 }}>
                Done
              </Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Header label */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <Text style={{ fontFamily: "Manrope_500Medium", fontSize: 12, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase" }}>
                Report · {targetName}
              </Text>
              <TouchableOpacity onPress={handleDismiss} hitSlop={12}>
                <Text style={{ fontFamily: "Manrope_400Regular", fontSize: 18, color: MUTED }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Title */}
            <Text style={{ fontFamily: "Caveat_700Bold", fontSize: 38, color: WARM_BROWN, lineHeight: 42, marginBottom: 8 }}>
              What happened?
            </Text>

            {/* Subtitle */}
            <Text style={{ fontFamily: "Manrope_400Regular", fontSize: 14, color: MUTED, lineHeight: 21, marginBottom: 32 }}>
              Reports are private. Our moderators review within 24h.
            </Text>

            {/* Reason cards */}
            <View style={{ gap: 10, marginBottom: 24 }}>
              {REASONS.map((reason) => {
                const selected = selectedReason === reason.key;
                return (
                  <TouchableOpacity
                    key={reason.key}
                    testID={`reason-${reason.key}`}
                    activeOpacity={0.75}
                    onPress={() => {
                      setSelectedReason(reason.key);
                      setNoReasonError(false);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 18,
                      paddingHorizontal: 20,
                      borderRadius: 16,
                      borderWidth: 1.5,
                      borderColor: selected ? WARM_BROWN : BORDER,
                      backgroundColor: selected ? "#EAE0D4" : CARD_BG,
                    }}
                  >
                    <Text style={{
                      fontFamily: "Manrope_500Medium",
                      fontSize: 15,
                      color: selected ? WARM_BROWN : "#5A4A42",
                      flex: 1,
                      paddingRight: 12,
                    }}>
                      {reason.label}
                    </Text>
                    {"isText" in reason ? (
                      <Text style={{ fontFamily: "Manrope_400Regular", fontSize: 16, color: MUTED }}>···</Text>
                    ) : (
                      <Text style={{ fontSize: 20 }}>{reason.emoji}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {noReasonError && (
              <Text testID="no-reason-error" style={{ fontFamily: "Manrope_400Regular", fontSize: 13, color: "#C0392B", marginBottom: 12 }}>
                Please select a reason to continue.
              </Text>
            )}

            {/* Optional detail */}
            <TextInput
              testID="flag-detail-input"
              value={detail}
              onChangeText={setDetail}
              placeholder="Add more detail (optional)…"
              multiline
              numberOfLines={3}
              maxLength={DETAIL_MAX + 10}
              style={{
                borderWidth: 1.5,
                borderColor: BORDER,
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontFamily: "Manrope_400Regular",
                fontSize: 14,
                color: WARM_BROWN,
                backgroundColor: CARD_BG,
                marginBottom: 4,
                minHeight: 72,
                textAlignVertical: "top",
              }}
              placeholderTextColor={MUTED}
            />
            <Text
              testID={detailTooLong ? "char-count-warning" : "char-count"}
              style={{
                fontFamily: "Manrope_400Regular",
                fontSize: 12,
                color: detailTooLong ? "#C0392B" : MUTED,
                textAlign: "right",
                marginBottom: 24,
              }}
            >
              {detail.length}/{DETAIL_MAX}{detailTooLong ? " — too long" : ""}
            </Text>

            {submitError && (
              <Text testID="flag-submit-error" style={{ fontFamily: "Manrope_400Regular", fontSize: 13, color: "#C0392B", marginBottom: 16 }}>
                {submitError}
              </Text>
            )}

            {/* Continue button */}
            <Pressable
              testID="flag-submit-btn"
              onPress={handleContinue}
              disabled={isDisabled}
              accessibilityState={{ disabled: isDisabled }}
              style={({ pressed }) => ({
                backgroundColor: isDisabled ? "#8A7570" : pressed ? "#3d2318" : WARM_BROWN,
                borderRadius: 100,
                paddingVertical: 18,
                alignItems: "center",
                marginBottom: 16,
              })}
            >
              <Text style={{ fontFamily: "Manrope_700Bold", fontSize: 16, color: BG, letterSpacing: 0.3 }}>
                {flagMutation.isPending ? "Submitting…" : "Continue"}
              </Text>
            </Pressable>

            {/* Footer note */}
            <Text style={{ fontFamily: "Manrope_400Regular", fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 20 }}>
              They won't know you reported.
            </Text>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
