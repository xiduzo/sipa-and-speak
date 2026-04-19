import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Spinner } from "heroui-native";
import { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Container } from "@/components/container";
import { trpc, queryClient } from "@/utils/trpc";

export default function ProposeMeetupScreen() {
  const { partnerId, partnerName } = useLocalSearchParams<{
    partnerId: string;
    partnerName: string;
  }>();
  const router = useRouter();

  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [time, setTime] = useState(""); // HH:MM
  const [error, setError] = useState<string | null>(null);

  // Derive YYYY-MM-DD string from selectedDate
  const date = selectedDate
    ? selectedDate.toLocaleDateString("sv-SE") // "sv-SE" gives YYYY-MM-DD format
    : "";

  const venuesQuery = useQuery(trpc.venue.listForPicker.queryOptions());
  const hasLocationsQuery = useQuery(trpc.venue.hasActiveLocations.queryOptions());
  const slotsQuery = useQuery(
    trpc.meetup.getAvailableSlots.queryOptions(
      { partnerId: partnerId ?? "", date },
      { enabled: !!partnerId && !!date },
    ),
  );

  const proposeMutation = useMutation(
    trpc.meetup.propose.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.meetup.list.queryOptions({ status: "pending" }));
        void queryClient.invalidateQueries(trpc.matching.getMyMatches.queryOptions());
        Alert.alert(
          "Proposal sent!",
          `Your meetup proposal has been sent to ${partnerName ?? "your partner"}.`,
          [{ text: "OK", onPress: () => router.back() }],
        );
      },
      onError: (err) => setError(err.message),
    }),
  );

  if (hasLocationsQuery.data === false) {
    return (
      <Container isScrollable={false}>
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-foreground text-lg font-semibold text-center mb-2">No locations available</Text>
          <Text className="text-muted-foreground text-center">
            No on-campus locations are currently available. Please check back later.
          </Text>
        </View>
      </Container>
    );
  }

  function handleSubmit() {
    setError(null);
    if (!selectedVenueId) { setError("Please select a location"); return; }
    if (!selectedDate) { setError("Please select a date"); return; }
    if (!time.match(/^\d{2}:\d{2}$/)) { setError("Enter a time in HH:MM format"); return; }
    const proposed = new Date(`${date}T${time}:00`);
    if (proposed <= new Date()) { setError("The selected date and time must be in the future"); return; }
    if (!partnerId) return;
    proposeMutation.mutate({ partnerId, venueId: selectedVenueId, date, time });
  }

  return (
    <Container>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-foreground text-2xl font-bold mb-6">Propose a meetup</Text>

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
                <Text className={`font-medium ${selectedVenueId === v.id ? "text-primary" : "text-foreground"}`}>{v.name}</Text>
                {v.description ? (
                  <Text className="text-muted-foreground text-sm mt-0.5">{v.description}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text className="text-foreground font-semibold mb-2">Date</Text>
        <Pressable
          testID="date-input"
          onPress={() => setShowDatePicker(true)}
          className="border border-border rounded-xl px-3 py-2 bg-card mb-6"
        >
          <Text className={selectedDate ? "text-foreground" : "text-muted-foreground"}>
            {selectedDate
              ? selectedDate.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "long", day: "numeric" })
              : "Select a date"}
          </Text>
        </Pressable>
        {showDatePicker && (
          <DateTimePicker
            testID="date-picker"
            value={selectedDate ?? new Date()}
            mode="date"
            minimumDate={new Date()}
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={(_event, picked) => {
              setShowDatePicker(Platform.OS === "ios");
              if (picked) { setSelectedDate(picked); setError(null); }
            }}
          />
        )}

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
            testID="time-input"
            value={time}
            onChangeText={(t) => { setTime(t); setError(null); }}
            placeholder="14:00"
            className="border border-border rounded-xl px-3 py-2 text-foreground bg-card mb-6"
            placeholderTextColor="#888"
          />
        )}

        {error && <Text testID="proposal-error" className="text-destructive text-sm mb-4">{error}</Text>}

        <Button onPress={handleSubmit} isDisabled={proposeMutation.isPending} testID="submit-proposal-btn">
          <Button.Label>{proposeMutation.isPending ? "Sending…" : "Send proposal"}</Button.Label>
        </Button>
      </ScrollView>
    </Container>
  );
}
