import { useMutation } from "@tanstack/react-query";
import { Alert, Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { trpc } from "@/utils/trpc";
import { firstInitial, profileSections } from "@/utils/profile-presentation";
import { getLanguageCode, getLanguageFlag } from "@/utils/language-flags";

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
  onAccept: () => void;
  onDecline: () => void;
  onBack?: () => void;
}

export function MatchCard({
  candidate,
  onAccept,
  onDecline,
  onBack,
}: MatchCardProps) {
  const insets = useSafeAreaInsets();
  const sendRequestMutation = useMutation({
    ...trpc.matching.sendMatchRequest.mutationOptions(),
  });

  const matchPct = Math.round(candidate.score * 100);
  const initial = firstInitial(candidate.name ?? "");
  const compatible = new Set(candidate.compatibleLanguages ?? []);
  const sections = profileSections(candidate);
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
          {sections.speaks.items.length === 0 ? (
            <Text className="text-white font-manrope" style={{ opacity: 0.8 }}>—</Text>
          ) : (
            sections.speaks.items.map((item) => {
              const isMatch = compatible.has(item.value);
              return (
                <View
                  key={item.value}
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
                    {item.flag} {item.label}
                    {item.detail ? ` · ${item.detail}` : ""}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {sections.learning.items.length > 0 && (
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
              {sections.learning.items.map((item) => {
                const isMatch = compatible.has(item.value);
                return (
                  <View
                    key={item.value}
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
                      {item.flag} {item.label}
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

      {/* Bottom — partner */}
      <View
        className="px-6 pt-6 pb-2"
        style={{ backgroundColor: CREAM, flex: 5 }}
      >
        {sections.topics.items.length > 0 ? (
          <>
            <Text
              testID="partner-interests-label"
              className="text-brand-muted-foreground font-manrope-semi tracking-widest"
              style={{ fontSize: 12 }}
            >
              {partnerLabel} IS INTO
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-3">
              {sections.topics.items.slice(0, 6).map((item) => (
                <View
                  key={item.value}
                  testID="interest-chip"
                  className="px-4 py-2 rounded-full"
                  style={{ backgroundColor: CHIP }}
                >
                  <Text
                    className="font-manrope-semi text-brand-foreground"
                    style={{ fontSize: 16 }}
                  >
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text
              testID="partner-interests-empty-label"
              className="text-brand-muted-foreground font-manrope-semi tracking-widest"
              style={{ fontSize: 12 }}
            >
              ABOUT {partnerLabel}
            </Text>
            <Text
              testID="partner-interests-empty"
              className="text-brand-foreground font-jakarta"
              style={{ fontSize: 24, lineHeight: 30, marginTop: 8 }}
            >
              {candidate.university
                ? `Studies at ${candidate.university}.`
                : `Hasn't shared interests yet — say hoi to find out more.`}
            </Text>
          </>
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
