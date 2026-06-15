import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Container } from "@/components/container";
import { trpc } from "@/utils/trpc";

/**
 * Conversation Starters entry point, gated on the buddy's profile languages.
 *
 * A buddy with no spoken or learning languages has nothing to practice, so the
 * screen guides them to add languages first. Everyone with at least one
 * language reaches the ready-state container that later Features (#377 picker,
 * #378 deck) fill in.
 */
export default function ConversationStartersScreen() {
  const router = useRouter();
  const profileQuery = useQuery(trpc.profile.getMyProfile.queryOptions());

  if (profileQuery.isPending) {
    return <LoadingState />;
  }

  if (profileQuery.isError) {
    return <ErrorState />;
  }

  const languages = profileQuery.data?.languages ?? [];
  const hasLanguages = languages.length > 0;

  if (!hasLanguages) {
    return <EmptyState onAddLanguages={() => router.push("/(tabs)/home")} />;
  }

  return <ReadyState />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <Container>
      <View className="flex-1 items-center justify-center p-6">{children}</View>
    </Container>
  );
}

function LoadingState() {
  return (
    <Centered>
      <Text
        testID="conversation-starters-loading"
        className="text-center text-sm text-muted-foreground"
      >
        Loading your languages…
      </Text>
    </Centered>
  );
}

function ErrorState() {
  return (
    <Centered>
      <Text
        testID="conversation-starters-error"
        className="text-center text-lg font-semibold text-foreground"
      >
        Something went wrong
      </Text>
      <Text className="mt-2 text-center text-sm text-muted-foreground">
        We couldn't load your languages. Please try again.
      </Text>
    </Centered>
  );
}

function EmptyState({ onAddLanguages }: { onAddLanguages: () => void }) {
  return (
    <Centered>
      <View testID="conversation-starters-empty" className="items-center">
        <Text className="text-center text-lg font-semibold text-foreground">
          No languages yet
        </Text>
        <Text className="mt-2 text-center text-sm text-muted-foreground">
          Add the languages you speak or want to learn to your profile to start
          practising with conversation starters.
        </Text>
        <Pressable
          testID="conversation-starters-empty-cta"
          accessibilityRole="button"
          onPress={onAddLanguages}
          className="mt-6 rounded-full bg-primary px-6 py-3"
        >
          <Text className="text-center text-sm font-semibold text-primary-foreground">
            Add a language
          </Text>
        </Pressable>
      </View>
    </Centered>
  );
}

function ReadyState() {
  return (
    <Centered>
      <View testID="conversation-starters-entry-point" className="items-center">
        <Text className="text-center text-lg font-semibold text-foreground">
          Conversation Starters
        </Text>
        <Text className="mt-2 text-center text-sm text-muted-foreground">
          Your practice cards will appear here.
        </Text>
      </View>
    </Centered>
  );
}
