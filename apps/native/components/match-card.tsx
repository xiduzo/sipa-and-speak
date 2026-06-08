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
  compatibleLanguages?: string[];
}

interface MatchCardProps {
  candidate: MatchCardCandidate;
  yourLanguage: string;
  onAccept: () => void;
  onDecline: () => void;
  onBack?: () => void;
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

  const matchPct = Math.round(candidate.score * 100);
  const initial = (candidate.name?.charAt(0) ?? "?").toUpperCase();
  const compatible = new Set(candidate.compatibleLanguages ?? []);
  const partnerLabel = (candidate.name ?? "They").toUpperCase();

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
        className="px-6 pb-5"
        style={{ backgroundColor: ROSE, flex: 6, paddingTop: insets.top + 24 }}
      >
        <View className="flex-row items-center gap-3 mb-4">
          {candidate.image ? (
            <Image
              testID="match-card-photo"
              source={{ uri: candidate.image }}
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                borderWidth: 2,
                borderColor: "rgba(255,255,255,0.85)",
              }}
            />
          ) : (
            <View
              testID="match-card-photo-placeholder"
              className="items-center justify-center"
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                borderWidth: 2,
                borderColor: "rgba(255,255,255,0.85)",
                backgroundColor: "rgba(255,255,255,0.12)",
              }}
            >
              <Text
                className="text-white font-jakarta"
                style={{ fontSize: 26 }}
              >
                {initial}
              </Text>
            </View>
          )}
          <View className="flex-1">
            <Text
              className="text-white font-jakarta"
              style={{ fontSize: 26, lineHeight: 30 }}
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

        <Text
          testID="partner-speaks-label"
          className="text-white font-manrope-semi tracking-widest"
          style={{ fontSize: 11, opacity: 0.9 }}
        >
          {partnerLabel} SPEAKS
        </Text>
        <View
          className="flex-row flex-wrap mt-2"
          style={{ gap: 6 }}
          testID="partner-spoken-languages"
        >
          {candidate.spokenLanguages.length === 0 ? (
            <Text className="text-white font-manrope" style={{ opacity: 0.8 }}>—</Text>
          ) : (
            candidate.spokenLanguages.map((l) => {
              const isMatch = compatible.has(l.language);
              return (
                <View
                  key={l.language}
                  testID={isMatch ? "partner-spoken-match-chip" : "partner-spoken-chip"}
                  className="px-3 py-1 rounded-full"
                  style={{
                    backgroundColor: isMatch ? GOLD : "rgba(255,255,255,0.18)",
                  }}
                >
                  <Text
                    className="font-manrope-semi"
                    style={{
                      fontSize: 13,
                      color: isMatch ? "#2C1810" : "#FFFFFF",
                    }}
                  >
                    {getLanguageFlag(l.language)} {l.language}
                    {l.proficiency ? ` · ${l.proficiency}` : ""}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {candidate.learningLanguages.length > 0 && (
          <>
            <Text
              testID="partner-learning-label"
              className="text-white font-manrope-semi tracking-widest mt-3"
              style={{ fontSize: 11, opacity: 0.9 }}
            >
              {partnerLabel} IS LEARNING
            </Text>
            <View
              className="flex-row flex-wrap mt-2"
              style={{ gap: 6 }}
              testID="partner-learning-languages"
            >
              {candidate.learningLanguages.map((lang) => {
                const isMatch = compatible.has(lang);
                return (
                  <View
                    key={lang}
                    testID={isMatch ? "partner-learning-match-chip" : "partner-learning-chip"}
                    className="px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: isMatch ? GOLD : "transparent",
                      borderWidth: 1.5,
                      borderColor: isMatch ? GOLD : "rgba(255,255,255,0.55)",
                      borderStyle: isMatch ? "solid" : "dashed",
                    }}
                  >
                    <Text
                      className="font-manrope-semi"
                      style={{
                        fontSize: 13,
                        color: isMatch ? "#2C1810" : "#FFFFFF",
                      }}
                    >
                      {getLanguageFlag(lang)} {lang}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>

      {/* Swap band — matching languages */}
      <View
        className="px-4 py-3"
        style={{ backgroundColor: "#FFFFFF" }}
        testID="match-overlap-band"
      >
        <View className="flex-row items-center justify-between">
          <Text
            className="font-manrope-semi tracking-widest text-brand-muted-foreground"
            style={{ fontSize: 11 }}
          >
            MATCHING IN
          </Text>
          <View
            testID="match-percent"
            className="px-3 py-0.5 rounded-full"
            style={{ backgroundColor: GOLD }}
          >
            <Text className="font-manrope-bold" style={{ fontSize: 12 }}>
              {matchPct}%
            </Text>
          </View>
        </View>
        <View
          className="flex-row flex-wrap mt-2"
          style={{ gap: 6 }}
          testID="match-overlap-languages"
        >
          {compatible.size === 0 ? (
            <Text
              className="font-manrope text-brand-muted-foreground"
              style={{ fontSize: 13 }}
            >
              No overlapping languages — review carefully.
            </Text>
          ) : (
            Array.from(compatible).map((lang) => (
              <View
                key={lang}
                className="flex-row items-center px-3 py-1 rounded-full"
                style={{ backgroundColor: GOLD, gap: 4 }}
              >
                <Text className="font-manrope-bold" style={{ fontSize: 13 }}>
                  {getLanguageFlag(lang)} {getLanguageCode(lang)}
                </Text>
              </View>
            ))
          )}
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
