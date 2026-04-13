import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button, Spinner } from "heroui-native";
import { useState, useCallback } from "react";
import { FlatList, Image, Pressable, RefreshControl, Share, Text, View } from "react-native";

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

export default function SuggestionsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const discoverQuery = useQuery(trpc.matching.discover.queryOptions({}));
  const incomingRequestsQuery = useQuery(
    trpc.matching.getIncomingRequests.queryOptions(),
  );

  const partners = discoverQuery.data?.partners ?? [];
  const incomingRequests = incomingRequestsQuery.data ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([discoverQuery.refetch(), incomingRequestsQuery.refetch()]);
    setRefreshing(false);
  }, [discoverQuery, incomingRequestsQuery]);

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
