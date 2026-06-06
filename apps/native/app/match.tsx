import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Spinner } from "heroui-native";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MatchCard } from "@/components/match-card";
import { getLanguageFlag } from "@/utils/language-flags";
import { trpc } from "@/utils/trpc";

const GOLD = "#F2C94C";
const CREAM = "#FBEFE4";

function pickYourLanguage(
  languages: { language: string; type: string; proficiency: string | null }[],
): string {
  const native = languages.find(
    (l) => l.type === "spoken" && l.proficiency === "native",
  );
  if (native) return native.language;
  const anySpoken = languages.find((l) => l.type === "spoken");
  return anySpoken?.language ?? "English";
}

function EmptyDeck({
  yourLanguage,
  onRefresh,
  isRefreshing,
}: {
  yourLanguage: string;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="empty-suggestion-state"
      className="flex-1"
      style={{ backgroundColor: CREAM }}
    >
      {/* Top — looking */}
      <View
        className="px-6"
        style={{ flex: 6, paddingTop: 64 }}
      >
        <View className="items-center" style={{ marginBottom: 32 }}>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <View
              className="items-center justify-center rounded-full"
              style={{
                width: 64,
                height: 64,
                backgroundColor: "#FFFFFF",
              }}
            >
              <Text style={{ fontSize: 28 }}>
                {getLanguageFlag(yourLanguage)}
              </Text>
            </View>
            <Text
              className="font-manrope-bold text-brand-muted-foreground"
              style={{ fontSize: 18 }}
            >
              ⇄
            </Text>
            <View
              testID="empty-deck-pending-slot"
              className="items-center justify-center rounded-full"
              style={{
                width: 64,
                height: 64,
                borderWidth: 2,
                borderStyle: "dashed",
                borderColor: "rgba(0,0,0,0.25)",
              }}
            >
              <Text
                className="text-brand-muted-foreground font-manrope-bold"
                style={{ fontSize: 22 }}
              >
                ?
              </Text>
            </View>
          </View>
        </View>
        <View className="flex-1 justify-end" style={{ paddingBottom: 24 }}>
          <Text
            className="text-brand-muted-foreground font-manrope-semi tracking-widest"
            style={{ fontSize: 12 }}
          >
            THAT WAS THE LAST ONE
          </Text>
          <Text
            className="text-brand-foreground font-jakarta"
            style={{ fontSize: 44, lineHeight: 48, marginTop: 4 }}
          >
            Looking for
          </Text>
          <Text
            className="text-brand-foreground font-jakarta italic"
            style={{ fontSize: 36, lineHeight: 40 }}
          >
            your next match…
          </Text>
        </View>
      </View>

      {/* Status band */}
      <View
        className="flex-row items-center px-6 py-3"
        style={{ backgroundColor: "#FFFFFF", gap: 8 }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: GOLD,
          }}
        />
        <Text
          className="font-manrope-bold text-brand-foreground"
          style={{ fontSize: 14 }}
        >
          Brewing this week
        </Text>
      </View>

      {/* Body + CTA */}
      <View
        className="px-6 pt-6"
        style={{
          backgroundColor: CREAM,
          flex: 5,
          paddingBottom: insets.bottom + 16,
        }}
      >
        <Text
          className="text-brand-foreground font-manrope"
          style={{ fontSize: 16, lineHeight: 24 }}
        >
          We're brewing fresh pairs right now. Usually a day or two —
          sometimes the same afternoon.
        </Text>
        <View className="flex-1" />
        <Pressable
          testID="refresh-action"
          onPress={onRefresh}
          disabled={isRefreshing}
          className="items-center justify-center rounded-full"
          style={{
            height: 56,
            backgroundColor: GOLD,
            opacity: isRefreshing ? 0.6 : 1,
          }}
        >
          <Text className="font-manrope-bold" style={{ fontSize: 17 }}>
            {isRefreshing ? "Checking…" : "Tap me when fresh  ☕"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function MatchModalScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);

  const discoverQuery = useQuery(trpc.matching.discover.queryOptions({}));
  const profileQuery = useQuery(trpc.profile.getMyProfile.queryOptions());

  const partners = discoverQuery.data?.partners ?? [];
  const yourLanguage = useMemo(
    () => pickYourLanguage(profileQuery.data?.languages ?? []),
    [profileQuery.data],
  );

  function handleClose() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  }

  const current = partners[index];
  const isLoading = discoverQuery.isPending || profileQuery.isPending;

  return (
    <View className="flex-1 bg-background">
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : !current ? (
        <EmptyDeck
          yourLanguage={yourLanguage}
          onRefresh={() => {
            setIndex(0);
            void discoverQuery.refetch();
          }}
          isRefreshing={discoverQuery.isFetching}
        />
      ) : (
        <MatchCard
          candidate={current}
          yourLanguage={yourLanguage}
          onAccept={() => setIndex((i) => i + 1)}
          onDecline={() => setIndex((i) => i + 1)}
        />
      )}

      <Pressable
        testID="close-deck"
        onPress={handleClose}
        accessibilityLabel="Close"
        className="absolute items-center justify-center rounded-full"
        style={{
          top: 8,
          right: 16,
          width: 40,
          height: 40,
          backgroundColor: "rgba(255,255,255,0.85)",
        }}
      >
        <Text
          className="text-brand-foreground font-manrope-bold"
          style={{ fontSize: 20, lineHeight: 22 }}
        >
          ×
        </Text>
      </Pressable>
    </View>
  );
}
