import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Spinner } from "heroui-native";
import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Container } from "@/components/container";
import { trpc, queryClient } from "@/utils/trpc";

export default function RespondMeetupScreen() {
  const router = useRouter();
  // meetupId may be passed via deep-link from a notification tap
  const { meetupId: meetupIdParam } = useLocalSearchParams<{ meetupId?: string }>();

  const [counterMode, setCounterMode] = useState(false);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);

  const proposalQuery = useQuery(trpc.meetup.getPendingIncoming.queryOptions());
  const venuesQuery = useQuery(trpc.venue.listForPicker.queryOptions());
  const slotsQuery = useQuery(
    trpc.meetup.getAvailableSlots.queryOptions(
      { partnerId: proposalQuery.data?.proposer.id ?? "", date },
      { enabled: !!proposalQuery.data?.proposer.id && !!date },
    ),
  );

  const proposal = proposalQuery.data;
  // Prefer the deep-linked meetupId, fall back to incoming proposal from query
  const activeMeetupId = meetupIdParam ?? proposal?.meetupId;

  function invalidateAndGoBack() {
    void queryClient.invalidateQueries(trpc.meetup.getPendingIncoming.queryOptions());
    void queryClient.invalidateQueries(trpc.meetup.list.queryOptions({ status: "pending" }));
    void queryClient.invalidateQueries(trpc.meetup.pendingCount.queryOptions());
    router.back();
  }

  const acceptMutation = useMutation(
    trpc.meetup.acceptProposal.mutationOptions({
      onSuccess: () => {
        Alert.alert("Meetup confirmed!", "Your meetup has been confirmed.");
        invalidateAndGoBack();
      },
      onError: (err) => setError(err.message),
    }),
  );

  const counterMutation = useMutation(
    trpc.meetup.counterPropose.mutationOptions({
      onSuccess: () => {
        Alert.alert("Counter-proposal sent!", "Your counter-proposal has been sent.");
        invalidateAndGoBack();
      },
      onError: (err) => setError(err.message),
    }),
  );

  const declineMutation = useMutation(
    trpc.meetup.declineProposal.mutationOptions({
      onSuccess: () => {
        Alert.alert("Proposal declined", "The proposal has been declined.");
        invalidateAndGoBack();
      },
      onError: (err) => setError(err.message),
    }),
  );

  if (proposalQuery.isPending) {
    return (
      <Container isScrollable={false}>
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      </Container>
    );
  }

  if (!proposal || !activeMeetupId) {
    return (
      <Container isScrollable={false}>
        <View testID="no-proposal-state" className="flex-1 items-center justify-center p-6">
          <Text className="text-foreground text-lg font-semibold text-center mb-2">
            No incoming proposals
          </Text>
          <Text className="text-muted-foreground text-center">
            There are no pending meetup proposals waiting for your response.
          </Text>
        </View>
      </Container>
    );
  }

  const isPending =
    acceptMutation.isPending ||
    counterMutation.isPending ||
    declineMutation.isPending;

  function handleAccept() {
    setError(null);
    acceptMutation.mutate({ meetupId: activeMeetupId! });
  }

  function handleDecline() {
    setError(null);
    Alert.alert(
      "Decline proposal",
      "Are you sure you want to decline this meetup proposal?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: () => declineMutation.mutate({ meetupId: activeMeetupId! }),
        },
      ],
    );
  }

  function handleCounterSubmit() {
    setError(null);
    if (!selectedVenueId) { setError("Please select a location"); return; }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) { setError("Enter a date in YYYY-MM-DD format"); return; }
    if (!time.match(/^\d{2}:\d{2}$/)) { setError("Enter a time in HH:MM format"); return; }
    const proposed = new Date(`${date}T${time}:00`);
    if (proposed <= new Date()) { setError("Date and time must be in the future"); return; }
    counterMutation.mutate({ meetupId: activeMeetupId!, venueId: selectedVenueId, date, time });
  }

  if (counterMode) {
    return (
      <Container>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text className="text-foreground text-2xl font-bold mb-1">Counter-propose</Text>
          <Text testID="counter-round-label" className="text-muted-foreground text-sm mb-6">
            Round {proposal.round + 1} of 3
          </Text>

          <Text className="text-foreground font-semibold mb-2">Location</Text>
          {venuesQuery.isPending ? (
            <Spinner />
          ) : (
            <View className="flex flex-col gap-2 mb-6">
              {(venuesQuery.data ?? []).map((v) => (
                <TouchableOpacity
                  key={v.id}
                  testID="venue-option"
                  onPress={() => setSelectedVenueId(v.id)}
                  className={`border rounded-xl p-3 ${selectedVenueId === v.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}
                >
                  <Text className={`font-medium ${selectedVenueId === v.id ? "text-primary" : "text-foreground"}`}>
                    {v.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text className="text-foreground font-semibold mb-2">Date (YYYY-MM-DD)</Text>
          <TextInput
            testID="counter-date-input"
            value={date}
            onChangeText={(t) => { setDate(t); setError(null); }}
            placeholder="2026-05-01"
            className="border border-border rounded-xl px-3 py-2 text-foreground bg-card mb-6"
            placeholderTextColor="#888"
          />

          <Text className="text-foreground font-semibold mb-2">Time</Text>
          {date && slotsQuery.data ? (
            <View className="flex flex-row flex-wrap gap-2 mb-6">
              {slotsQuery.data.map((slot) => (
                <TouchableOpacity
                  key={slot}
                  testID="time-slot"
                  onPress={() => setTime(slot)}
                  className={`border rounded-lg px-3 py-1.5 ${time === slot ? "border-primary bg-primary/10" : "border-border bg-card"}`}
                >
                  <Text className={time === slot ? "text-primary font-medium" : "text-foreground"}>{slot}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TextInput
              testID="counter-time-input"
              value={time}
              onChangeText={(t) => { setTime(t); setError(null); }}
              placeholder="14:00"
              className="border border-border rounded-xl px-3 py-2 text-foreground bg-card mb-6"
              placeholderTextColor="#888"
            />
          )}

          {error && (
            <Text testID="counter-error" className="text-destructive text-sm mb-4">{error}</Text>
          )}

          <View className="flex flex-col gap-3">
            <Button
              testID="submit-counter-btn"
              onPress={handleCounterSubmit}
              isDisabled={isPending}
            >
              <Button.Label>
                {counterMutation.isPending ? "Sending…" : "Send counter-proposal"}
              </Button.Label>
            </Button>
            <Button
              variant="ghost"
              onPress={() => { setCounterMode(false); setError(null); }}
              isDisabled={isPending}
            >
              <Button.Label>Back</Button.Label>
            </Button>
          </View>
        </ScrollView>
      </Container>
    );
  }

  return (
    <Container>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-foreground text-2xl font-bold mb-1">Meetup proposal</Text>
        <Text testID="round-label" className="text-muted-foreground text-sm mb-6">
          Round {proposal.round} of 3
        </Text>

        <View className="bg-card border border-border rounded-2xl p-4 mb-6">
          <Text testID="proposer-name" className="text-foreground font-semibold text-base mb-4">
            From {proposal.proposer.name}
          </Text>

          <View className="flex flex-col gap-2">
            <View className="flex-row items-center gap-2">
              <Text className="text-muted-foreground text-sm w-20">Location</Text>
              <Text testID="proposal-venue" className="text-foreground font-medium flex-1">
                {proposal.venue.name}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-muted-foreground text-sm w-20">Date</Text>
              <Text testID="proposal-date" className="text-foreground font-medium flex-1">
                {proposal.date}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-muted-foreground text-sm w-20">Time</Text>
              <Text testID="proposal-time" className="text-foreground font-medium flex-1">
                {proposal.time}
              </Text>
            </View>
          </View>
        </View>

        {error && (
          <Text testID="response-error" className="text-destructive text-sm mb-4">{error}</Text>
        )}

        <View className="flex flex-col gap-3">
          <Button
            testID="accept-btn"
            onPress={handleAccept}
            isDisabled={isPending}
          >
            <Button.Label>
              {acceptMutation.isPending ? "Accepting…" : "Accept"}
            </Button.Label>
          </Button>

          {/* #73 — Counter-propose only available when round < 3 */}
          {proposal.canCounterPropose && (
            <Button
              testID="counter-propose-btn"
              variant="secondary"
              onPress={() => {
                setSelectedVenueId(proposal.venue.id);
                setDate(proposal.date);
                setTime(proposal.time);
                setCounterMode(true);
              }}
              isDisabled={isPending}
            >
              <Button.Label>Counter-propose</Button.Label>
            </Button>
          )}

          <Button
            testID="decline-btn"
            variant="ghost"
            onPress={handleDecline}
            isDisabled={isPending}
          >
            <Button.Label>
              {declineMutation.isPending ? "Declining…" : "Decline"}
            </Button.Label>
          </Button>
        </View>
      </ScrollView>
    </Container>
  );
}
