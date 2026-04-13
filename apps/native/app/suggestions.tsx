import { useQuery } from "@tanstack/react-query";
import { Button, Spinner } from "heroui-native";
import { useState, useCallback } from "react";
import { FlatList, RefreshControl, Share, Text, View } from "react-native";

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

export default function SuggestionsScreen() {
  const [refreshing, setRefreshing] = useState(false);

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
          <Text className="text-foreground text-2xl font-bold mb-4">
            Suggestions
          </Text>
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
