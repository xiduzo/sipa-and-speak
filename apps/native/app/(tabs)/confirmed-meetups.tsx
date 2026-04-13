import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button, Spinner } from "heroui-native";
import { Alert, ScrollView, Text, View } from "react-native";

import { Container } from "@/components/container";
import { trpc, queryClient } from "@/utils/trpc";

export default function ConfirmedMeetupsScreen() {
  const router = useRouter();
  const meetupsQuery = useQuery(trpc.meetup.getConfirmed.queryOptions());

  const cancelMutation = useMutation(
    trpc.meetup.cancelMeetup.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.meetup.getConfirmed.queryOptions());
        Alert.alert("Meetup cancelled", "The meetup has been cancelled.");
      },
      onError: (err) => Alert.alert("Error", err.message),
    }),
  );

  if (meetupsQuery.isPending) {
    return (
      <Container isScrollable={false}>
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      </Container>
    );
  }

  const meetups = meetupsQuery.data ?? [];

  if (meetups.length === 0) {
    return (
      <Container isScrollable={false}>
        <View testID="no-meetups-state" className="flex-1 items-center justify-center p-6">
          <Text className="text-foreground text-lg font-semibold text-center mb-2">
            No confirmed meetups
          </Text>
          <Text className="text-muted-foreground text-center">
            Accept a proposal to schedule your first Sip&Speak moment.
          </Text>
        </View>
      </Container>
    );
  }

  function handleCancel(meetupId: string) {
    Alert.alert(
      "Cancel meetup",
      "Are you sure you want to cancel this meetup?",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Cancel meetup",
          style: "destructive",
          onPress: () => cancelMutation.mutate({ meetupId }),
        },
      ],
    );
  }

  return (
    <Container>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-foreground text-2xl font-bold mb-6">Confirmed meetups</Text>
        {meetups.map((m) => (
          <View
            key={m.meetupId}
            testID="meetup-card"
            className="bg-card border border-border rounded-2xl p-4 mb-4"
          >
            <Text testID="meetup-partner" className="text-foreground font-semibold text-base mb-1">
              With {m.partner.name}
            </Text>
            <Text testID="meetup-venue" className="text-muted-foreground text-sm mb-0.5">
              {m.venue.name}
            </Text>
            <Text testID="meetup-datetime" className="text-muted-foreground text-sm mb-4">
              {m.date} at {m.time}
            </Text>

            {/* #79 — Cancel action hidden when meetup is in the past */}
            {!m.isPast && (
              <Button
                testID="cancel-meetup-btn"
                variant="ghost"
                onPress={() => handleCancel(m.meetupId)}
                isDisabled={cancelMutation.isPending}
              >
                <Button.Label>Cancel meetup</Button.Label>
              </Button>
            )}

            {m.isPast && (
              <Text testID="meetup-past-label" className="text-muted-foreground text-xs text-center">
                This meetup has already taken place
              </Text>
            )}
          </View>
        ))}
      </ScrollView>
    </Container>
  );
}
