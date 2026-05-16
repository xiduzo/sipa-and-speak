import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, View } from "react-native";

import { Container } from "@/components/container";
import { trpc, queryClient } from "@/utils/trpc";
import { CARD, GOLD } from "@/components/home/tokens";

const DARK = "#1A1A1A";
const MUTED = "#8A7570";
const DIVIDER = "#EFE7DD";
const CREAM_BORDER = "#FAF6F1";

const AVATAR_PALETTE = [
  "#E8B5AA", // rose
  "#B5CFC6", // sage
  "#D4B59E", // peach
  "#D6B7C2", // mauve
  "#E6D4B8", // sand
  "#C9D5C0", // moss
  "#E2C5B0", // clay
];

const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function avatarTone(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) % 4096;
  }
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]!;
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (
    parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)
  ).toUpperCase();
}

interface MatchEntry {
  matchId: string;
  partnerId: string;
  partnerName: string;
  partnerPhotoUrl: string | null;
  matchedAt: string;
}

function MatchAvatar({
  name,
  image,
  isNew,
}: {
  name: string;
  image: string | null;
  isNew?: boolean;
}) {
  const tone = avatarTone(name);
  const size = 84;
  return (
    <View style={{ width: size, height: size }}>
      <View
        className="items-center justify-center rounded-full"
        style={{ width: size, height: size, backgroundColor: tone }}
      >
        {image ? (
          <Image
            source={{ uri: image }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
          />
        ) : (
          <Text
            className="font-jakarta"
            style={{ fontSize: 30, color: DARK, letterSpacing: -0.5 }}
          >
            {initials(name)}
          </Text>
        )}
      </View>
      {isNew && (
        <View
          accessibilityLabel="new match"
          style={{
            position: "absolute",
            top: 2,
            right: 4,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: GOLD,
            borderWidth: 2,
            borderColor: CREAM_BORDER,
          }}
        />
      )}
    </View>
  );
}

function MatchTile({
  match,
  isNew,
  onPress,
}: {
  match: MatchEntry;
  isNew?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID="matched-partner-card"
      accessibilityRole="button"
      accessibilityLabel={`Open ${match.partnerName}`}
      onPress={onPress}
      style={({ pressed }) => ({
        width: "33.3333%",
        alignItems: "center",
        paddingHorizontal: 4,
        paddingVertical: 8,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <MatchAvatar
        name={match.partnerName}
        image={match.partnerPhotoUrl}
        isNew={isNew}
      />
      <Text
        className="font-jakarta"
        style={{ fontSize: 15, color: DARK, marginTop: 10 }}
        numberOfLines={1}
      >
        {match.partnerName}
      </Text>
    </Pressable>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      className="font-manrope-semi"
      style={{
        fontSize: 11,
        color: MUTED,
        letterSpacing: 2,
        marginBottom: 14,
      }}
    >
      {children}
    </Text>
  );
}

export default function MatchesScreen() {
  const router = useRouter();
  const matchesQuery = useQuery(
    trpc.matching.getMyMatches.queryOptions({ includeWithActiveMeetup: true }),
  );
  const incomingRequestsQuery = useQuery(
    trpc.matching.getIncomingRequests.queryOptions(),
  );

  const invalidateAll = () => {
    void queryClient.invalidateQueries(
      trpc.matching.getMyMatches.queryOptions({ includeWithActiveMeetup: true }),
    );
    void queryClient.invalidateQueries(trpc.matching.getMyMatches.queryOptions());
    void queryClient.invalidateQueries(trpc.matching.getIncomingRequests.queryOptions());
  };

  const acceptMutation = useMutation(
    trpc.matching.acceptMatchRequest.mutationOptions({ onSuccess: invalidateAll }),
  );
  const declineMutation = useMutation(
    trpc.matching.declineMatchRequest.mutationOptions({ onSuccess: invalidateAll }),
  );

  const matches = (matchesQuery.data ?? []) as MatchEntry[];
  const requests = incomingRequestsQuery.data ?? [];

  const now = Date.now();
  const newMatches = matches.filter(
    (m) => now - new Date(m.matchedAt).getTime() < NEW_WINDOW_MS,
  );
  const olderMatches = matches.filter(
    (m) => now - new Date(m.matchedAt).getTime() >= NEW_WINDOW_MS,
  );

  const isEmpty = matches.length === 0 && requests.length === 0;

  const openPartner = (partnerId: string) =>
    router.push({ pathname: "/partner/[id]", params: { id: partnerId } });

  return (
    <Container isScrollable={false}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 18 }}>
          <Text
            className="font-jakarta"
            style={{ fontSize: 42, lineHeight: 46, color: DARK, letterSpacing: -0.5 }}
          >
            Matches
          </Text>
          {!isEmpty && (
            <View className="flex-row items-center" style={{ gap: 8, marginTop: 4 }}>
              <Text className="font-manrope" style={{ fontSize: 14, color: MUTED }}>
                {matches.length} {matches.length === 1 ? "match" : "matches"}
              </Text>
              {newMatches.length > 0 && (
                <>
                  <Text className="font-manrope" style={{ fontSize: 14, color: MUTED }}>
                    ·
                  </Text>
                  <Text
                    className="font-manrope-semi"
                    style={{ fontSize: 14, color: GOLD }}
                  >
                    {newMatches.length} new this week
                  </Text>
                </>
              )}
            </View>
          )}
        </View>

        {/* Match requests */}
        {requests.length > 0 && (
          <View style={{ paddingHorizontal: 24, marginBottom: 28 }}>
            <SectionLabel>REQUESTS</SectionLabel>
            <View style={{ gap: 12 }}>
              {requests.map((req) => {
                const pending =
                  (acceptMutation.isPending &&
                    acceptMutation.variables?.matchRequestId === req.matchRequestId) ||
                  (declineMutation.isPending &&
                    declineMutation.variables?.matchRequestId === req.matchRequestId);
                const tone = avatarTone(req.requesterName);
                return (
                  <View
                    key={req.matchRequestId}
                    testID="incoming-request-card"
                    style={{
                      backgroundColor: CARD,
                      borderRadius: 18,
                      padding: 16,
                    }}
                  >
                    <Pressable
                      onPress={() =>
                        router.push(
                          `/partner/${req.requesterId}?matchRequestId=${req.matchRequestId}` as never,
                        )
                      }
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <View style={{ width: 52, height: 52 }}>
                        <View
                          className="items-center justify-center rounded-full"
                          style={{
                            width: 52,
                            height: 52,
                            backgroundColor: tone,
                          }}
                        >
                          {req.requesterPhotoUrl ? (
                            <Image
                              source={{ uri: req.requesterPhotoUrl }}
                              style={{ width: 52, height: 52, borderRadius: 26 }}
                            />
                          ) : (
                            <Text
                              className="font-jakarta"
                              style={{ fontSize: 20, color: DARK }}
                            >
                              {initials(req.requesterName)}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          className="font-jakarta"
                          style={{ fontSize: 17, color: DARK }}
                          numberOfLines={1}
                        >
                          {req.requesterName}
                        </Text>
                        {req.requesterOfferedLanguages.length > 0 && (
                          <Text
                            className="font-manrope"
                            style={{ fontSize: 13, color: MUTED, marginTop: 2 }}
                            numberOfLines={1}
                          >
                            Speaks {req.requesterOfferedLanguages.join(", ")}
                            {req.requesterTargetedLanguages.length > 0
                              ? ` · Learning ${req.requesterTargetedLanguages.join(", ")}`
                              : ""}
                          </Text>
                        )}
                      </View>
                    </Pressable>

                    <View
                      className="flex-row"
                      style={{ gap: 10, marginTop: 14 }}
                    >
                      <Pressable
                        testID="accept-match-request"
                        disabled={pending}
                        onPress={() =>
                          acceptMutation.mutate({ matchRequestId: req.matchRequestId })
                        }
                        style={({ pressed }) => ({
                          flex: 1,
                          alignItems: "center",
                          justifyContent: "center",
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: GOLD,
                          opacity: pending ? 0.5 : pressed ? 0.85 : 1,
                        })}
                      >
                        <Text
                          className="font-manrope-semi"
                          style={{ fontSize: 14, color: DARK }}
                        >
                          Accept
                        </Text>
                      </Pressable>
                      <Pressable
                        testID="decline-match-request"
                        disabled={pending}
                        onPress={() =>
                          declineMutation.mutate({ matchRequestId: req.matchRequestId })
                        }
                        style={({ pressed }) => ({
                          flex: 1,
                          alignItems: "center",
                          justifyContent: "center",
                          height: 40,
                          borderRadius: 20,
                          borderWidth: 1,
                          borderColor: DIVIDER,
                          opacity: pending ? 0.5 : pressed ? 0.7 : 1,
                        })}
                      >
                        <Text
                          className="font-manrope-semi"
                          style={{ fontSize: 14, color: MUTED }}
                        >
                          Decline
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* New this week */}
        {newMatches.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
            <View style={{ paddingHorizontal: 4 }}>
              <SectionLabel>NEW THIS WEEK</SectionLabel>
            </View>
            <View className="flex-row flex-wrap">
              {newMatches.map((m) => (
                <MatchTile
                  key={m.matchId}
                  match={m}
                  isNew
                  onPress={() => openPartner(m.partnerId)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Everyone */}
        {olderMatches.length > 0 && (
          <View style={{ paddingHorizontal: 20 }}>
            <View style={{ paddingHorizontal: 4 }}>
              <SectionLabel>
                {newMatches.length > 0 ? "EVERYONE" : "MY MATCHES"}
              </SectionLabel>
            </View>
            <View className="flex-row flex-wrap">
              {olderMatches.map((m) => (
                <MatchTile
                  key={m.matchId}
                  match={m}
                  onPress={() => openPartner(m.partnerId)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Empty state */}
        {isEmpty && (
          <View
            className="items-center px-8"
            style={{ paddingTop: 96 }}
          >
            <View
              className="items-center justify-center rounded-full mb-6"
              style={{ width: 72, height: 72, backgroundColor: CARD }}
            >
              <Text style={{ fontSize: 32 }}>☕</Text>
            </View>
            <Text
              className="font-jakarta text-center mb-2"
              style={{ fontSize: 24, color: DARK }}
            >
              No matches yet
            </Text>
            <Text
              className="font-manrope text-center"
              style={{ fontSize: 14, color: MUTED, lineHeight: 20 }}
            >
              Find someone new from the home screen — when you both say hoi, they'll show up here.
            </Text>
          </View>
        )}
      </ScrollView>
    </Container>
  );
}
