import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Spinner } from "heroui-native";
import { useState } from "react";
import { Alert, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { Container } from "@/components/container";
import { MeetupConfirmedModal } from "@/components/meetup-confirmed-modal";
import { trpc, queryClient } from "@/utils/trpc";

export default function RespondMeetupScreen() {
  const router = useRouter();
  // meetupId may be passed via deep-link from a notification tap
  const { meetupId: meetupIdParam } = useLocalSearchParams<{ meetupId?: string }>();

  const [counterMode, setCounterMode] = useState(false);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ venueName: string; date: string; time: string } | null>(null);

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

  function invalidateQueries() {
    void queryClient.invalidateQueries(trpc.meetup.getPendingIncoming.queryOptions());
    void queryClient.invalidateQueries(trpc.meetup.list.queryOptions({ status: "pending" }));
    void queryClient.invalidateQueries(trpc.meetup.pendingCount.queryOptions());
    void queryClient.invalidateQueries(trpc.matching.getMyMatches.queryOptions());
  }

  const acceptMutation = useMutation(
    trpc.meetup.acceptProposal.mutationOptions({
      onSuccess: () => {
        invalidateQueries();
        if (proposal) {
          setConfirmed({ venueName: proposal.venue.name, date: proposal.date, time: proposal.time });
        } else {
          router.back();
        }
      },
      onError: (err) => setError(err.message),
    }),
  );

  const counterMutation = useMutation(
    trpc.meetup.counterPropose.mutationOptions({
      onSuccess: () => {
        Alert.alert("Counter-proposal sent!", "Your counter-proposal has been sent.");
        invalidateQueries();
        router.back();
      },
      onError: (err) => setError(err.message),
    }),
  );

  const declineMutation = useMutation(
    trpc.meetup.declineProposal.mutationOptions({
      onSuccess: () => {
        invalidateQueries();
        if (!proposal?.canCounterPropose) {
          Alert.alert(
            "No match found",
            "Oops, you couldn't find a suitable timeslot to meet. You can try to propose a meeting again.",
            [{ text: "OK", onPress: () => router.back() }],
          );
        } else {
          Alert.alert("Proposal declined", "The proposal has been declined.");
          router.back();
        }
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

  if (confirmed) {
    return (
      <MeetupConfirmedModal
        visible
        venueName={confirmed.venueName}
        date={confirmed.date}
        time={confirmed.time}
        onDismiss={() => { setConfirmed(null); router.back(); }}
      />
    );
  }

  if (!proposal || !activeMeetupId) {
    return (
      <Container isScrollable={false}>
        <View testID="no-proposal-state" className="flex-1 items-center justify-center p-6">
          <Text className="text-foreground text-lg font-manrope-bold text-center mb-2">
            No incoming proposals
          </Text>
          <Text className="text-muted-foreground font-manrope text-center">
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
          <Text className="text-foreground text-2xl font-manrope-bold mb-1">Counter-propose</Text>
          <Text testID="counter-round-label" className="text-muted-foreground font-manrope text-sm mb-6">
            Round {proposal.round + 1} of 5
          </Text>

          <Text className="font-manrope-semi text-[11px] tracking-[2px] uppercase mb-2" style={{ color: "#8A7570" }}>Location</Text>
          {venuesQuery.isPending ? (
            <Spinner />
          ) : (
            <View className="flex flex-col gap-2 mb-6">
              {(venuesQuery.data ?? []).map((v) => (
                <TouchableOpacity
                  key={v.id}
                  testID="venue-option"
                  onPress={() => setSelectedVenueId(v.id)}
                  className="rounded-xl p-3"
                  style={{
                    borderWidth: 1.5,
                    borderColor: selectedVenueId === v.id ? "#F2C94C" : "#D9C9BC",
                    backgroundColor: selectedVenueId === v.id ? "#FFF9EC" : "#F5EFE8",
                  }}
                >
                  <Text className="font-manrope-semi" style={{ color: selectedVenueId === v.id ? "#2C1810" : "#8A7570" }}>
                    {v.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text className="font-manrope-semi text-[11px] tracking-[2px] uppercase mb-2" style={{ color: "#8A7570" }}>Date</Text>
          <TouchableOpacity
            testID="counter-date-input"
            className="border border-border rounded-xl px-3 py-2 bg-card mb-3"
            onPress={() => setShowDatePicker(true)}
          >
            <Text className="text-foreground font-manrope">
              {date ? new Date(date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "Select a date"}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              testID="counter-date-picker"
              value={date ? new Date(date) : new Date()}
              mode="date"
              minimumDate={new Date()}
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={(_event, picked) => {
                setShowDatePicker(Platform.OS === "ios");
                if (picked) {
                  const y = picked.getFullYear();
                  const m = String(picked.getMonth() + 1).padStart(2, "0");
                  const d = String(picked.getDate()).padStart(2, "0");
                  setDate(`${y}-${m}-${d}`);
                  setError(null);
                }
              }}
            />
          )}

          <Text className="font-manrope-semi text-[11px] tracking-[2px] uppercase mb-2 mt-4" style={{ color: "#8A7570" }}>Time</Text>
          {date && slotsQuery.data ? (
            <View className="flex flex-row flex-wrap gap-2 mb-6">
              {slotsQuery.data.map((slot) => (
                <TouchableOpacity
                  key={slot}
                  testID="time-slot"
                  onPress={() => setTime(slot)}
                  className="rounded-lg px-3 py-1.5"
                  style={{
                    borderWidth: 1.5,
                    borderColor: time === slot ? "#F2C94C" : "#D9C9BC",
                    backgroundColor: time === slot ? "#FFF9EC" : "transparent",
                  }}
                >
                  <Text className={`font-manrope${time === slot ? "-semi" : ""}`} style={{ color: time === slot ? "#2C1810" : "#8A7570" }}>{slot}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text className="text-muted-foreground font-manrope text-sm mb-6">Select a date to see available time slots</Text>
          )}

          {error && (
            <Text testID="counter-error" className="text-destructive text-sm font-manrope mb-4">{error}</Text>
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
              onPress={() => { setCounterMode(false); setError(null); setShowDatePicker(false); }}
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
        <Text className="text-foreground text-2xl font-manrope-bold mb-1">Meetup proposal</Text>
        <Text testID="round-label" className="text-muted-foreground font-manrope text-sm mb-6">
          Round {proposal.round} of 5
        </Text>

        <View className="bg-card border border-border rounded-2xl p-4 mb-6">
          <Text testID="proposer-name" className="text-foreground font-manrope-semi text-base mb-4">
            From {proposal.proposer.name}
          </Text>

          <View className="flex flex-col gap-2">
            <View className="flex-row items-center gap-2">
              <Text className="text-muted-foreground font-manrope text-sm w-20">Location</Text>
              <Text testID="proposal-venue" className="text-foreground font-manrope-semi flex-1">
                {proposal.venue.name}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-muted-foreground font-manrope text-sm w-20">Date</Text>
              <Text testID="proposal-date" className="text-foreground font-manrope-semi flex-1">
                {proposal.date}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-muted-foreground font-manrope text-sm w-20">Time</Text>
              <Text testID="proposal-time" className="text-foreground font-manrope-semi flex-1">
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
