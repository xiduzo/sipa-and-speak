import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, View } from "react-native";

import { Container } from "@/components/container";
import { trpc } from "@/utils/trpc";
import { GOLD } from "@/components/home/tokens";

export default function MatchesScreen() {
  const router = useRouter();
  const matchesQuery = useQuery(trpc.matching.getMyMatches.queryOptions());
  const incomingRequestsQuery = useQuery(trpc.matching.getIncomingRequests.queryOptions());

  const matches = matchesQuery.data ?? [];
  const requests = incomingRequestsQuery.data ?? [];

  return (
    <Container>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 }}>
        <Text className="font-caveat text-[28px] text-foreground mb-6">Matches</Text>

        {matches.length > 0 && (
          <View className="mb-8">
            <Text
              className="font-manrope-semi tracking-widest text-brand-muted-foreground mb-3"
              style={{ fontSize: 12 }}
            >
              MY MATCHES
            </Text>
            <View className="flex-row flex-wrap gap-4">
              {matches.map((match) => (
                <Pressable
                  key={match.matchId}
                  testID="matched-partner-card"
                  onPress={() =>
                    router.push({
                      pathname: "/partner/[id]",
                      params: { id: match.partnerId },
                    })
                  }
                  className="items-center active:opacity-70"
                >
                  {match.partnerPhotoUrl ? (
                    <Image
                      source={{ uri: match.partnerPhotoUrl }}
                      style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: "#D9C9BC" }}
                    />
                  ) : (
                    <View
                      className="items-center justify-center rounded-full"
                      style={{ width: 56, height: 56, backgroundColor: GOLD, borderWidth: 2, borderColor: "#D9C9BC" }}
                    >
                      <Text className="font-manrope-bold" style={{ fontSize: 20 }}>
                        {(match.partnerName || "?").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text
                    className="text-brand-foreground font-manrope-semi mt-1"
                    style={{ fontSize: 11 }}
                    numberOfLines={1}
                  >
                    {match.partnerName}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {requests.length > 0 && (
          <View>
            <Text
              className="font-manrope-semi tracking-widest text-brand-muted-foreground mb-3"
              style={{ fontSize: 12 }}
            >
              MATCH REQUESTS
            </Text>
            <View className="gap-3">
              {requests.map((req) => (
                <Pressable
                  key={req.matchRequestId}
                  testID="incoming-request-card"
                  onPress={() =>
                    router.push(
                      `/partner/${req.requesterId}?matchRequestId=${req.matchRequestId}` as never,
                    )
                  }
                  className="bg-card border border-border rounded-2xl p-4 active:opacity-70"
                >
                  <View className="flex-row items-center gap-3">
                    {req.requesterPhotoUrl ? (
                      <Image
                        source={{ uri: req.requesterPhotoUrl }}
                        style={{ width: 44, height: 44, borderRadius: 22 }}
                      />
                    ) : (
                      <View
                        className="items-center justify-center rounded-full bg-muted"
                        style={{ width: 44, height: 44 }}
                      >
                        <Text className="text-muted-foreground text-lg font-semibold">
                          {(req.requesterName || "?").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className="text-foreground font-semibold text-base">
                        {req.requesterName}
                      </Text>
                      {req.requesterOfferedLanguages.length > 0 && (
                        <Text className="text-muted-foreground text-xs mt-0.5">
                          Speaks {req.requesterOfferedLanguages.join(", ")}
                          {req.requesterTargetedLanguages.length > 0
                            ? ` · Learning ${req.requesterTargetedLanguages.join(", ")}`
                            : ""}
                        </Text>
                      )}
                    </View>
                    <Text className="text-brand-muted-foreground text-xs">›</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {matches.length === 0 && requests.length === 0 && (
          <View className="flex-1 items-center justify-center pt-20">
            <Text className="font-manrope text-brand-muted-foreground text-center" style={{ fontSize: 15 }}>
              No matches yet.{"\n"}Find someone new from the home screen.
            </Text>
          </View>
        )}
      </ScrollView>
    </Container>
  );
}
