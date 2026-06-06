import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  Text,
  View,
} from "react-native";
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

const { width: SCREEN_W } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_W * 0.28;

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
}

export function MatchCard({
  candidate,
  yourLanguage,
  onAccept,
  onDecline,
}: MatchCardProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sendRequestMutation = useMutation({
    ...trpc.matching.sendMatchRequest.mutationOptions(),
  });

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

  function openProfile() {
    router.push({ pathname: "/partner/[id]", params: { id: candidate.userId } });
  }

  // --- Swipe deck (#13) — RN core Animated + PanResponder, no extra native deps.
  // Left = skip, right = send invite. Latest handlers held in a ref so the
  // once-created PanResponder never calls a stale closure for a past candidate.
  const pan = useRef(new Animated.ValueXY()).current;
  const actionsRef = useRef({ accept: handleAccept, decline: onDecline });
  actionsRef.current.accept = handleAccept;
  actionsRef.current.decline = onDecline;

  // New candidate mounted into the same card instance → recentre.
  useEffect(() => {
    pan.setValue({ x: 0, y: 0 });
  }, [candidate.userId, pan]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_evt, g) => {
        if (g.dx > SWIPE_THRESHOLD) {
          Animated.timing(pan, {
            toValue: { x: SCREEN_W * 1.4, y: g.dy },
            duration: 220,
            useNativeDriver: false,
          }).start(() => actionsRef.current.accept());
        } else if (g.dx < -SWIPE_THRESHOLD) {
          Animated.timing(pan, {
            toValue: { x: -SCREEN_W * 1.4, y: g.dy },
            duration: 220,
            useNativeDriver: false,
          }).start(() => actionsRef.current.decline());
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 6,
            useNativeDriver: false,
          }).start();
        }
      },
    }),
  ).current;

  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_W / 2, 0, SCREEN_W / 2],
    outputRange: ["-8deg", "0deg", "8deg"],
    extrapolate: "clamp",
  });
  const likeOpacity = pan.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const nopeOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      testID="match-card"
      className="flex-1"
      style={{
        backgroundColor: CREAM,
        transform: [
          { translateX: pan.x },
          { translateY: pan.y },
          { rotate },
        ],
      }}
      accessibilityActions={[
        { name: "invite", label: "Send invite" },
        { name: "skip", label: "Skip" },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "invite") handleAccept();
        else if (e.nativeEvent.actionName === "skip") onDecline();
      }}
      {...panResponder.panHandlers}
    >
      {/* Swipe verdict overlays */}
      <Animated.View
        testID="swipe-like-overlay"
        pointerEvents="none"
        className="absolute z-10 px-4 py-2 rounded-2xl"
        style={{
          top: insets.top + 28,
          left: 24,
          opacity: likeOpacity,
          borderWidth: 3,
          borderColor: "#2E7D32",
          transform: [{ rotate: "-12deg" }],
        }}
      >
        <Text className="font-jakarta" style={{ fontSize: 26, color: "#2E7D32" }}>
          HOI!
        </Text>
      </Animated.View>
      <Animated.View
        testID="swipe-nope-overlay"
        pointerEvents="none"
        className="absolute z-10 px-4 py-2 rounded-2xl"
        style={{
          top: insets.top + 28,
          right: 24,
          opacity: nopeOpacity,
          borderWidth: 3,
          borderColor: "#B0463C",
          transform: [{ rotate: "12deg" }],
        }}
      >
        <Text className="font-jakarta" style={{ fontSize: 26, color: "#B0463C" }}>
          SKIP
        </Text>
      </Animated.View>

      {/* Top — partner */}
      <View
        testID="match-card-partner"
        className="px-6 pb-5"
        style={{ backgroundColor: ROSE, flex: 6, paddingTop: insets.top + 24 }}
      >
        <View className="flex-row items-center gap-3 mb-4">
          {/* #11 — tap photo to open the full profile */}
          <Pressable
            testID="match-card-photo-button"
            onPress={openProfile}
            accessibilityLabel={`View ${candidate.name}'s profile`}
          >
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
          </Pressable>
          <Pressable
            testID="match-card-name-button"
            onPress={openProfile}
            className="flex-1"
          >
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
          </Pressable>
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
        <Text
          className="font-manrope-semi tracking-widest text-brand-muted-foreground"
          style={{ fontSize: 11 }}
        >
          MATCHING IN
        </Text>
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

      {/* Action row — swipe-only deck keeps just the primary confirm (#13).
          Skip = swipe left; the dashed hint tells first-timers. */}
      <View
        className="px-6 pt-2"
        style={{ backgroundColor: CREAM, paddingBottom: insets.bottom + 16 }}
      >
        <Pressable
          testID="accept-button"
          onPress={handleAccept}
          disabled={sendRequestMutation.isPending}
          className="items-center justify-center rounded-full"
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
        <Text
          testID="swipe-hint"
          className="text-brand-muted-foreground font-manrope text-center mt-3"
          style={{ fontSize: 12 }}
        >
          ← swipe to skip   ·   swipe to say hoi →
        </Text>
      </View>
    </Animated.View>
  );
}
