import { useQuery } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { Button, Spinner } from "heroui-native";
import { useState, useCallback, useEffect } from "react";
import { FlatList, Platform, RefreshControl, Share, Text, View } from "react-native";

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

export default function SuggestionsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(true);

  useEffect(() => {
    if (Platform.OS === "web") return;
    Notifications.getPermissionsAsync()
      .then((perm) => setNotificationsGranted(perm.granted))
      .catch(() => { /* ignore — banner is informational only */ });
  }, []);

  const discoverQuery = useQuery(trpc.matching.discover.queryOptions({}));

  const partners = discoverQuery.data?.partners ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await discoverQuery.refetch();
    setRefreshing(false);
  }, [discoverQuery]);

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
