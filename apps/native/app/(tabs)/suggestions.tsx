import { useQuery } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { Button, Spinner } from "heroui-native";
import { useState, useCallback, useEffect } from "react";
import { FlatList, Image, Platform, Pressable, RefreshControl, Share, Text, TouchableOpacity, View } from "react-native";

import { CandidateCard } from "@/components/candidate-card";
import { Container } from "@/components/container";
import { trpc } from "@/utils/trpc";

const APP_SHARE_URL = "https://sip-and-speak.app";
const APP_SHARE_MESSAGE =
  "I'm using Sip&Speak to find a language exchange partner at TU/e — you should join too! " +
  APP_SHARE_URL;

function EmptySuggestionState() {
  async function handleShare() {
    await Share.share({ message: APP_SHARE_MESSAGE, url: APP_SHARE_URL });
  }

  return (
    <View testID="empty-suggestion-state" className="flex-1 items-center justify-center px-6 gap-4">
      <Text className="text-foreground text-xl font-semibold text-center">
        No matches yet
      </Text>
      <Text className="text-muted-foreground text-center">
        We couldn't find a match for your language yet — would you like to share
        this app with a friend?
      </Text>
      <Button onPress={handleShare} testID="share-action">
        <Button.Label>Share the app</Button.Label>
      </Button>
    </View>
  );
}

function EnableNotificationsBanner() {
  return (
    <View
      testID="enable-notifications-banner"
      className="bg-muted border border-border rounded-xl px-4 py-3 mb-4 flex-row items-center gap-3"
    >
      <Text className="text-muted-foreground text-sm flex-1">
        Enable notifications to be alerted instantly when someone wants to meet you.
      </Text>
    </View>
  );
}

function IncomingRequestItem({
  request,
  onPress,
}: {
  request: {
    matchRequestId: string;
    requesterId: string;
    requesterName: string;
    requesterPhotoUrl: string | null;
    requesterOfferedLanguages: string[];
    requesterTargetedLanguages: string[];
    createdAt: string;
  };
  onPress: () => void;
}) {
  return (
    <Pressable
      testID="incoming-request-item"
      onPress={onPress}
      className="bg-card border border-border rounded-2xl p-4 mb-3"
    >
      <View className="flex-row items-center gap-3 mb-2">
        {request.requesterPhotoUrl ? (
          <Image
            testID="requester-photo"
            source={{ uri: request.requesterPhotoUrl }}
            className="w-12 h-12 rounded-full"
          />
        ) : (
          <View
            testID="requester-photo-placeholder"
            className="w-12 h-12 rounded-full bg-muted items-center justify-center"
          >
            <Text className="text-muted-foreground text-lg font-semibold">
              {request.requesterName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text testID="requester-name" className="text-foreground text-base font-semibold flex-1">
          {request.requesterName}
        </Text>
      </View>

      {request.requesterOfferedLanguages.length > 0 && (
        <View className="flex-row flex-wrap gap-1 mb-1">
          {request.requesterOfferedLanguages.map((lang) => (
            <View key={lang} className="bg-primary/10 px-2 py-0.5 rounded-full">
              <Text className="text-primary text-xs">{lang}</Text>
            </View>
          ))}
        </View>
      )}

      {request.requesterTargetedLanguages.length > 0 && (
        <View className="flex-row flex-wrap gap-1">
          {request.requesterTargetedLanguages.map((lang) => (
            <View key={lang} className="bg-secondary/10 px-2 py-0.5 rounded-full">
              <Text className="text-secondary-foreground text-xs">{lang}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

function MatchItem({
  match,
  onPropose,
}: {
  match: {
    matchId: string;
    partnerId: string;
    partnerName: string;
    partnerPhotoUrl: string | null;
    matchedAt: string;
  };
  onPropose: () => void;
}) {
  return (
    <View
      testID="match-item"
      className="bg-card border border-border rounded-2xl p-4 mb-3"
    >
      <View className="flex-row items-center gap-3 mb-3">
        {match.partnerPhotoUrl ? (
          <Image
            source={{ uri: match.partnerPhotoUrl }}
            className="w-12 h-12 rounded-full"
          />
        ) : (
          <View className="w-12 h-12 rounded-full bg-muted items-center justify-center">
            <Text className="text-muted-foreground text-lg font-semibold">
              {match.partnerName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text className="text-foreground text-base font-semibold flex-1">
          {match.partnerName}
        </Text>
      </View>
      <TouchableOpacity
        testID="propose-meetup-btn"
        onPress={onPropose}
        className="bg-primary rounded-xl py-2.5 items-center"
      >
        <Text className="text-primary-foreground font-semibold text-sm">Propose a meetup</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function SuggestionsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(true);

  useEffect(() => {
    if (Platform.OS === "web") return;
    Notifications.getPermissionsAsync()
      .then((perm) => setNotificationsGranted(perm.granted))
      .catch(() => { /* ignore — banner is informational only */ });
  }, []);

  const discoverQuery = useQuery(trpc.matching.discover.queryOptions({}));
  const incomingRequestsQuery = useQuery(
    trpc.matching.getIncomingRequests.queryOptions(),
  );
  const myMatchesQuery = useQuery(trpc.matching.getMyMatches.queryOptions());

  const partners = discoverQuery.data?.partners ?? [];
  const incomingRequests = incomingRequestsQuery.data ?? [];
  const myMatches = myMatchesQuery.data ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([discoverQuery.refetch(), incomingRequestsQuery.refetch(), myMatchesQuery.refetch()]);
    setRefreshing(false);
  }, [discoverQuery, incomingRequestsQuery, myMatchesQuery]);

  if (discoverQuery.isPending) {
    return (
      <Container isScrollable={false}>
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      </Container>
    );
  }

  if (!discoverQuery.isPending && partners.length === 0) {
    return (
      <Container isScrollable={false}>
        <View className="flex-1 p-4">
          {!notificationsGranted && <EnableNotificationsBanner />}
          {incomingRequests.length > 0 && (
            <View testID="incoming-requests-section" className="mb-6">
              <Text className="text-foreground text-lg font-bold mb-3">
                People who want to meet you
              </Text>
              {incomingRequests.map((req) => (
                <IncomingRequestItem
                  key={req.matchRequestId}
                  request={req}
                  onPress={() => router.push({ pathname: "/partner/[id]", params: { id: req.requesterId, matchRequestId: req.matchRequestId } })}
                />
              ))}
            </View>
          )}
          {myMatches.length > 0 && (
            <View testID="my-matches-section" className="mb-6">
              <Text className="text-foreground text-lg font-bold mb-3">
                Your matches
              </Text>
              {myMatches.map((match) => (
                <MatchItem
                  key={match.matchId}
                  match={match}
                  onPropose={() => router.push({ pathname: "/propose-meetup", params: { partnerId: match.partnerId, partnerName: match.partnerName } })}
                />
              ))}
            </View>
          )}
          <Text className="text-foreground text-2xl font-bold mb-4">Suggestions</Text>
          <EmptySuggestionState />
        </View>
      </Container>
    );
  }

  return (
    <Container isScrollable={false}>
      <FlatList
        data={partners}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <>
            {!notificationsGranted && <EnableNotificationsBanner />}

            {/* #126 — Incoming match requests section */}
            {incomingRequests.length > 0 && (
              <View testID="incoming-requests-section" className="mb-6">
                <Text className="text-foreground text-lg font-bold mb-3">
                  People who want to meet you
                </Text>
                {incomingRequests.map((req) => (
                  <IncomingRequestItem
                    key={req.matchRequestId}
                    request={req}
                    onPress={() => router.push({ pathname: "/partner/[id]", params: { id: req.requesterId, matchRequestId: req.matchRequestId } })}
                  />
                ))}
              </View>
            )}

            {/* Your matches — accepted pairs awaiting meetup proposal */}
            {myMatches.length > 0 && (
              <View testID="my-matches-section" className="mb-6">
                <Text className="text-foreground text-lg font-bold mb-3">
                  Your matches
                </Text>
                {myMatches.map((match) => (
                  <MatchItem
                    key={match.matchId}
                    match={match}
                    onPropose={() => router.push({ pathname: "/propose-meetup", params: { partnerId: match.partnerId, partnerName: match.partnerName } })}
                  />
                ))}
              </View>
            )}

            <Text className="text-foreground text-2xl font-bold mb-4">
              Suggestions
            </Text>
          </>
        }
        renderItem={({ item }) => (
          <CandidateCard
            userId={item.userId}
            name={item.name}
            image={item.image}
            spokenLanguages={item.spokenLanguages}
            learningLanguages={item.learningLanguages}
            interests={item.interests}
          />
        )}
      />
    </Container>
  );
}
