import { useMutation } from "@tanstack/react-query";
import { Alert, Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { trpc } from "@/utils/trpc";
import { interestLabel } from "@/utils/interest-labels";
import {
  getLanguageCode,
  getLanguageFlag,
  getNativeName,
} from "@/utils/language-flags";

const GOLD = "#F2C94C";
const CHIP = "#C8E0E0";
const ROSE = "#C99A8A";
const CREAM = "#FBEFE4";

interface SpokenLanguage {
  language: string;
  proficiency: string | null;
}

export interface MatchCardCandidate {
  userId: string;
  name: string;
  image: string | null;
  age: number | null;
  university: string | null;
  spokenLanguages: SpokenLanguage[];
  learningLanguages: string[];
  interests: string[];
  score: number;
}

interface MatchCardProps {
  candidate: MatchCardCandidate;
  yourLanguage: string;
  onAccept: () => void;
  onDecline: () => void;
  onBack?: () => void;
}

function pickTheirNative(spokenLanguages: SpokenLanguage[]): {
  language: string;
  proficiency: string;
} {
  const native = spokenLanguages.find((l) => l.proficiency === "native");
  if (native) return { language: native.language, proficiency: "native" };
  const first = spokenLanguages[0];
  return {
    language: first?.language ?? "—",
    proficiency: first?.proficiency ?? "fluent",
  };
}

export function MatchCard({
  candidate,
  yourLanguage,
  onAccept,
  onDecline,
  onBack,
}: MatchCardProps) {
  const insets = useSafeAreaInsets();
  const sendRequestMutation = useMutation({
    ...trpc.matching.sendMatchRequest.mutationOptions(),
  });

  const their = pickTheirNative(candidate.spokenLanguages);
  const theirNativeName = their.language ? getNativeName(their.language) : "—";
  const matchPct = Math.round(candidate.score * 100);
  const initial = (candidate.name?.charAt(0) ?? "?").toUpperCase();

  function handleAccept() {
    sendRequestMutation.mutate(
      { receiverId: candidate.userId },
      {
        onSuccess: () => {
          Alert.alert(
            "Invitation sent!",
            "Your match request is on its way. Sit tight — we'll let you know when they respond.",
            [{ text: "Got it", onPress: onAccept }],
          );
        },
        onError: () => onAccept(),
      },
    );
  }

  return (
    <View
      testID="match-card"
      className="flex-1"
      style={{ backgroundColor: CREAM }}
    >
      {/* Top — partner */}
      <View
        testID="match-card-partner"
        className="px-6 pb-6"
        style={{ backgroundColor: ROSE, flex: 6, paddingTop: insets.top + 24 }}
      >
        <View className="flex-1 justify-between">
          <View>
            <Text
              className="text-white font-manrope-semi tracking-widest"
              style={{ fontSize: 12, opacity: 0.9 }}
            >
              SHE SPEAKS
            </Text>
            <Text
              className="text-white font-jakarta"
              style={{ fontSize: 56, lineHeight: 60, marginTop: 4 }}
            >
              {theirNativeName}
            </Text>
            <Text
              className="text-white font-manrope-md italic"
              style={{
                fontSize: 26,
                opacity: 0.95,
                borderBottomWidth: 3,
                borderColor: GOLD,
                borderStyle: "dashed",
                alignSelf: "flex-start",
                paddingBottom: 4,
              }}
            >
              {their.proficiency}
            </Text>
          </View>

          <View className="flex-row items-center gap-3">
            {candidate.image ? (
              <Image
                testID="match-card-photo"
                source={{ uri: candidate.image }}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  borderWidth: 2,
                  borderColor: "rgba(255,255,255,0.85)",
                }}
              />
            ) : (
              <View
                testID="match-card-photo-placeholder"
                className="items-center justify-center"
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  borderWidth: 2,
                  borderColor: "rgba(255,255,255,0.85)",
                  backgroundColor: "rgba(255,255,255,0.12)",
                }}
              >
                <Text
                  className="text-white font-jakarta"
                  style={{ fontSize: 28 }}
                >
                  {initial}
                </Text>
              </View>
            )}
            <View className="flex-1">
              <Text
                className="text-white font-manrope-bold"
                style={{ fontSize: 18 }}
              >
                {candidate.name}
                {candidate.age != null ? `, ${candidate.age}` : ""}
              </Text>
              {candidate.university && (
                <Text
                  className="text-white font-manrope"
                  style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}
                >
                  {candidate.university}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Swap band */}
      <View
        className="flex-row items-center justify-center gap-3 py-3 px-4"
        style={{ backgroundColor: "#FFFFFF" }}
      >
        <Text className="font-manrope-bold" style={{ fontSize: 16 }}>
          {getLanguageFlag(their.language)} {getLanguageCode(their.language)}
        </Text>
        <View
          className="items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: GOLD,
          }}
        >
          <Text className="font-manrope-bold" style={{ fontSize: 16 }}>
            ⇄
          </Text>
        </View>
        <Text
          className="font-manrope-bold text-brand-foreground"
          style={{ fontSize: 16 }}
        >
          {getLanguageCode(yourLanguage)} {getLanguageFlag(yourLanguage)}
        </Text>
        <View
          testID="match-percent"
          className="ml-2 px-3 py-1 rounded-full"
          style={{ backgroundColor: GOLD }}
        >
          <Text className="font-manrope-bold" style={{ fontSize: 13 }}>
            {matchPct}%
          </Text>
        </View>
      </View>

      {/* Bottom — you */}
      <View
        className="px-6 pt-6 pb-2"
        style={{ backgroundColor: CREAM, flex: 5 }}
      >
        <Text
          className="text-brand-muted-foreground font-manrope-semi tracking-widest"
          style={{ fontSize: 12 }}
        >
          YOU SPEAK
        </Text>
        <Text
          className="text-brand-foreground font-jakarta"
          style={{ fontSize: 44, lineHeight: 48, marginTop: 4 }}
        >
          {getNativeName(yourLanguage)}
        </Text>

        {candidate.interests.length > 0 && (
          <View className="flex-row flex-wrap gap-2 mt-4">
            {candidate.interests.slice(0, 4).map((topic) => (
              <View
                key={topic}
                testID="interest-chip"
                className="px-3 py-1.5 rounded-full"
                style={{ backgroundColor: CHIP }}
              >
                <Text
                  className="font-manrope-semi text-brand-foreground"
                  style={{ fontSize: 13 }}
                >
                  {interestLabel(topic)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Action row */}
      <View
        className="flex-row items-center gap-3 px-6 pt-2"
        style={{ backgroundColor: CREAM, paddingBottom: insets.bottom + 16 }}
      >
        {onBack && (
          <Pressable
            testID="back-button"
            onPress={onBack}
            className="items-center justify-center"
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: "#F0E5DA",
            }}
          >
            <Text
              className="font-manrope-bold text-brand-muted-foreground"
              style={{ fontSize: 22 }}
            >
              ←
            </Text>
          </Pressable>
        )}
        <Pressable
          testID="decline-button"
          onPress={onDecline}
          className="items-center justify-center"
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: "#F0E5DA",
          }}
        >
          <Text
            className="font-manrope-bold text-brand-muted-foreground"
            style={{ fontSize: 22 }}
          >
            ×
          </Text>
        </Pressable>
        <Pressable
          testID="accept-button"
          onPress={handleAccept}
          disabled={sendRequestMutation.isPending}
          className="flex-1 items-center justify-center rounded-full"
          style={{
            height: 56,
            backgroundColor: GOLD,
            opacity: sendRequestMutation.isPending ? 0.6 : 1,
          }}
        >
          <Text className="font-manrope-bold" style={{ fontSize: 17 }}>
            {sendRequestMutation.isPending ? "Sending…" : "Say hoi  →"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
