import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Spinner } from "heroui-native";
import { useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Container } from "@/components/container";
import { trpc, queryClient } from "@/utils/trpc";

const GOLD = "#F2C94C";
const GOLD_TINT = "#FCE9A0";
const ROSE = "#C99A8A";

type Suggestion = {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  weekday: string;
  hint?: string;
};

function toIsoDate(d: Date): string {
  return d.toLocaleDateString("sv-SE");
}

function buildSuggestions(): Suggestion[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const offsets = [1, 2, 4];
  const times = ["10:30", "14:00", "15:00"];
  const hints = ["your usual coffee slot", undefined, undefined];
  return offsets.map((off, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + off);
    return {
      date: toIsoDate(d),
      time: times[i] ?? "10:30",
      weekday: d.toLocaleDateString(undefined, { weekday: "long" }),
      hint: hints[i],
    };
  });
}

export default function ProposeMeetupScreen() {
  const { partnerId, partnerName } = useLocalSearchParams<{
    partnerId: string;
    partnerName: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState<number | null>(0);
  const [customMode, setCustomMode] = useState(false);
  const [customDate, setCustomDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customTime, setCustomTime] = useState("");
  const [error, setError] = useState<string | null>(null);

  const suggestions = useMemo(buildSuggestions, []);

  const venuesQuery = useQuery(trpc.venue.listForPicker.queryOptions());
  const hasLocationsQuery = useQuery(trpc.venue.hasActiveLocations.queryOptions());

  const slotChecks = useQueries({
    queries: suggestions.map((s) =>
      trpc.meetup.getAvailableSlots.queryOptions(
        { partnerId: partnerId ?? "", date: s.date },
        { enabled: !!partnerId },
      ),
    ),
  });

  const customDateIso = customDate ? toIsoDate(customDate) : "";
  const customSlotsQuery = useQuery(
    trpc.meetup.getAvailableSlots.queryOptions(
      { partnerId: partnerId ?? "", date: customDateIso },
      { enabled: !!partnerId && !!customDateIso },
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
          <Text className="text-brand-foreground font-jakarta text-lg text-center mb-2">
            No locations available
          </Text>
          <Text className="text-brand-muted-foreground font-manrope text-center">
            No on-campus locations are currently available. Please check back later.
          </Text>
        </View>
      </Container>
    );
  }

  function pickedDateTime(): { date: string; time: string } | null {
    if (customMode) {
      if (!customDateIso) return null;
      if (!customTime.match(/^\d{2}:\d{2}$/)) return null;
      return { date: customDateIso, time: customTime };
    }
    if (selectedSuggestionIdx === null) return null;
    const s = suggestions[selectedSuggestionIdx];
    return s ? { date: s.date, time: s.time } : null;
  }

  function handleSubmit() {
    setError(null);
    if (!partnerId) return;
    if (!selectedVenueId) {
      setError("Please pick a venue");
      return;
    }
    const dt = pickedDateTime();
    if (!dt) {
      setError(
        customMode ? "Please pick a date and time (HH:MM)" : "Please pick a suggested time",
      );
      return;
    }
    const proposed = new Date(`${dt.date}T${dt.time}:00`);
    if (proposed <= new Date()) {
      setError("The selected date and time must be in the future");
      return;
    }
    proposeMutation.mutate({ partnerId, venueId: selectedVenueId, ...dt });
  }

  const partnerInitial = (partnerName ?? "?").charAt(0).toUpperCase();
  const venues = venuesQuery.data ?? [];

  return (
    <Container isScrollable={false}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 8,
          paddingBottom: 32,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          testID="back-button"
          onPress={() => router.back()}
          className="self-start items-center justify-center rounded-full mb-4"
          style={{ width: 36, height: 36, backgroundColor: "#F0E5DA" }}
        >
          <Text className="text-brand-muted-foreground font-manrope-bold" style={{ fontSize: 16 }}>
            ←
          </Text>
        </Pressable>

        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-1 pr-4">
            <Text
              className="text-brand-muted-foreground font-manrope-semi tracking-widest mb-1"
              style={{ fontSize: 11 }}
            >
              PLAN A SIP
            </Text>
            <Text
              className="text-brand-foreground font-jakarta"
              style={{ fontSize: 36, lineHeight: 40 }}
              testID="propose-header"
            >
              with {partnerName ?? "partner"}
            </Text>
          </View>
          <View
            testID="partner-avatar"
            className="items-center justify-center rounded-full"
            style={{ width: 56, height: 56, backgroundColor: ROSE }}
          >
            <Text className="text-white font-jakarta" style={{ fontSize: 22 }}>
              {partnerInitial}
            </Text>
          </View>
        </View>

        <SectionLabel>PICK A VENUE</SectionLabel>
        {venuesQuery.isPending ? (
          <Spinner />
        ) : (
          <View className="gap-3 mb-6">
            {venues.map((v) => {
              const picked = selectedVenueId === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  testID="venue-option"
                  onPress={() => setSelectedVenueId(v.id)}
                  activeOpacity={0.85}
                  className="rounded-2xl px-4 py-3.5 flex-row items-center"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderWidth: picked ? 2 : 0,
                    borderColor: picked ? GOLD : "transparent",
                  }}
                >
                  <View className="flex-1 pr-3">
                    <Text
                      className="text-brand-foreground font-manrope-bold"
                      style={{ fontSize: 16 }}
                    >
                      {v.name}
                    </Text>
                    {v.description ? (
                      <Text
                        className="text-brand-muted-foreground font-manrope mt-0.5"
                        style={{ fontSize: 13 }}
                        numberOfLines={1}
                      >
                        {v.description}
                      </Text>
                    ) : null}
                  </View>
                  {picked ? (
                    <View
                      testID="venue-picked-badge"
                      className="rounded-full px-3 py-1"
                      style={{ backgroundColor: GOLD }}
                    >
                      <Text
                        className="text-brand-foreground font-manrope-semi"
                        style={{ fontSize: 12 }}
                      >
                        picked
                      </Text>
                    </View>
                  ) : (
                    <Text
                      className="text-brand-muted-foreground font-manrope-bold"
                      style={{ fontSize: 18 }}
                    >
                      →
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <SectionLabel>SUGGESTED TIMES</SectionLabel>
        <View className="gap-3 mb-3">
          {suggestions.map((s, idx) => {
            const slots = slotChecks[idx]?.data;
            const isFree = !!slots && slots.includes(s.time);
            const selected = !customMode && selectedSuggestionIdx === idx;
            const isTop = idx === 0;
            const subtitle = isFree
              ? s.hint
                ? `Both free · ${s.hint}`
                : "Both free"
              : "Tap or pick another time";
            return (
              <TouchableOpacity
                key={`${s.date}-${s.time}`}
                testID="suggested-time-option"
                onPress={() => {
                  setCustomMode(false);
                  setSelectedSuggestionIdx(idx);
                  setError(null);
                }}
                activeOpacity={0.85}
                className="rounded-2xl px-4 py-3.5 flex-row items-center"
                style={{
                  backgroundColor: selected
                    ? GOLD
                    : isTop
                      ? GOLD_TINT
                      : "#FFFFFF",
                }}
              >
                <View className="flex-1 pr-3">
                  <Text
                    className="text-brand-foreground font-manrope-bold"
                    style={{ fontSize: 16 }}
                  >
                    {s.weekday}, {s.time}
                  </Text>
                  <Text
                    className="text-brand-foreground font-manrope mt-0.5"
                    style={{ fontSize: 13, opacity: 0.75 }}
                    numberOfLines={1}
                  >
                    {subtitle}
                  </Text>
                </View>
                <Text
                  className="text-brand-foreground font-manrope-bold"
                  style={{ fontSize: 18 }}
                >
                  →
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Pressable
          testID="propose-another-time"
          onPress={() => {
            setCustomMode((m) => !m);
            setSelectedSuggestionIdx(null);
            setError(null);
          }}
          className="self-center py-2 mb-4"
        >
          <Text className="text-brand-muted-foreground font-manrope" style={{ fontSize: 14 }}>
            {customMode ? "Use a suggested time" : "Or propose another time"}
          </Text>
        </Pressable>

        {customMode && (
          <View className="mb-6 gap-3">
            <Pressable
              testID="date-input"
              onPress={() => setShowDatePicker(true)}
              className="rounded-2xl px-4 py-3.5"
              style={{ backgroundColor: "#FFFFFF" }}
            >
              <Text
                className="text-brand-muted-foreground font-manrope-semi tracking-widest"
                style={{ fontSize: 11 }}
              >
                DATE
              </Text>
              <Text
                className={`font-manrope-bold mt-0.5 ${customDate ? "text-brand-foreground" : "text-brand-muted-foreground"}`}
                style={{ fontSize: 16 }}
              >
                {customDate
                  ? customDate.toLocaleDateString(undefined, {
                      weekday: "short",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "Select a date"}
              </Text>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                testID="date-picker"
                value={customDate ?? new Date()}
                mode="date"
                minimumDate={new Date()}
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={(_event, picked) => {
                  setShowDatePicker(Platform.OS === "ios");
                  if (picked) {
                    setCustomDate(picked);
                    setError(null);
                  }
                }}
              />
            )}

            <View className="rounded-2xl px-4 py-3.5" style={{ backgroundColor: "#FFFFFF" }}>
              <Text
                className="text-brand-muted-foreground font-manrope-semi tracking-widest mb-1"
                style={{ fontSize: 11 }}
              >
                TIME
              </Text>
              {customDateIso && customSlotsQuery.data ? (
                <View className="flex flex-row flex-wrap gap-2 mt-1">
                  {customSlotsQuery.data.map((slot) => (
                    <TouchableOpacity
                      key={slot}
                      testID="time-slot"
                      onPress={() => setCustomTime(slot)}
                      className="rounded-lg px-3 py-1.5"
                      style={{
                        backgroundColor: customTime === slot ? GOLD : "#F5EFE8",
                      }}
                    >
                      <Text
                        className="text-brand-foreground font-manrope-semi"
                        style={{ fontSize: 14 }}
                      >
                        {slot}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <TextInput
                  testID="time-input"
                  value={customTime}
                  onChangeText={(t) => {
                    setCustomTime(t);
                    setError(null);
                  }}
                  placeholder="14:00"
                  className="text-brand-foreground font-manrope-bold"
                  style={{ fontSize: 16 }}
                  placeholderTextColor="#9b8d85"
                />
              )}
            </View>
          </View>
        )}

        {error && (
          <Text testID="proposal-error" className="text-destructive font-manrope text-sm mb-3">
            {error}
          </Text>
        )}

        <Button
          onPress={handleSubmit}
          isDisabled={proposeMutation.isPending}
          testID="submit-proposal-btn"
        >
          <Button.Label>
            {proposeMutation.isPending ? "Sending…" : "Send proposal"}
          </Button.Label>
        </Button>
      </ScrollView>
    </Container>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      className="text-brand-muted-foreground font-manrope-semi tracking-widest mb-3"
      style={{ fontSize: 11 }}
    >
      {children}
    </Text>
  );
}
