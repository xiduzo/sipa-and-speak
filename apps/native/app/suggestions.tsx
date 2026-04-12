import { useQuery } from "@tanstack/react-query";
import { Spinner } from "heroui-native";
import { useState, useCallback } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";

import { CandidateCard } from "@/components/candidate-card";
import { Container } from "@/components/container";
import { trpc } from "@/utils/trpc";

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
