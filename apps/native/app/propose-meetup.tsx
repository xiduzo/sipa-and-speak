import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Spinner } from "heroui-native";
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

import { trpc, queryClient } from "@/utils/trpc";

const GOLD = "#F2C94C";
const GOLD_TINT = "#FCE9A0";
const MUTED_BORDER = "#D9C9BC";

type Suggestion = {
  date: string;
  time: string;
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

function GoldButton({
  onPress, disabled, label, loading,
}: { onPress: () => void; disabled?: boolean; label: string; loading?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        backgroundColor: (disabled || loading) ? "#D4C898" : pressed ? "#DFB83A" : GOLD,
        borderRadius: 50,
        paddingVertical: 18,
        alignItems: "center",
        opacity: (disabled || loading) ? 0.7 : 1,
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
      })}
    >
      {loading && <Spinner size="sm" color="default" />}
      <Text
        className="font-manrope-bold text-[17px]"
        style={{ color: (disabled || loading) ? "#8A7570" : "#2C1810" }}
      >
        {label}
      </Text>
    </Pressable>
  );
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

  const venues = venuesQuery.data ?? [];

  return (
    <View
      className="flex-1 bg-background"
      style={{ flex: 1, paddingBottom: insets.bottom }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: insets.top + 12,
          paddingBottom: 32,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          testID="back-button"
          onPress={() => router.back()}
          className="self-start items-center justify-center rounded-full mb-6"
          style={{ width: 36, height: 36, backgroundColor: "#F0E5DA" }}
        >
          <Text className="text-brand-muted-foreground font-manrope-bold" style={{ fontSize: 16 }}>
            ←
          </Text>
        </Pressable>

        <View className="mb-8">
          <Text
            className="font-manrope-semi tracking-[2px] uppercase mb-1"
            style={{ fontSize: 11, color: GOLD }}
          >
            PLAN A SIP
          </Text>
          <Text
            className="font-caveat text-foreground leading-[46px]"
            style={{ fontSize: 42 }}
            testID="propose-header"
          >
            with {partnerName ?? "partner"}
          </Text>
        </View>

        <Text
          className="font-manrope-semi tracking-[2px] uppercase mb-3"
          style={{ fontSize: 11, color: "#8A7570" }}
        >
          PICK A VENUE
        </Text>

        {venuesQuery.isPending ? (
          <View className="items-center py-6">
            <Spinner />
          </View>
        ) : venues.length === 0 ? (
          <View
            className="rounded-2xl px-5 py-4 mb-6"
            style={{ backgroundColor: "#F5EFE8", borderWidth: 1.5, borderColor: MUTED_BORDER }}
          >
            <Text className="font-manrope text-[14px]" style={{ color: "#8A7570" }}>
              No venues available at the moment. Check back soon.
            </Text>
          </View>
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
                  className="rounded-2xl px-5 py-4 flex-row items-center"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderWidth: picked ? 2 : 1.5,
                    borderColor: picked ? GOLD : MUTED_BORDER,
                  }}
                >
                  <View className="flex-1 pr-3">
                    <Text className="font-manrope-bold text-foreground" style={{ fontSize: 16 }}>
                      {v.name}
                    </Text>
                    {v.description ? (
                      <Text
                        className="font-manrope mt-0.5"
                        style={{ fontSize: 13, color: "#8A7570" }}
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
                      <Text className="font-manrope-semi text-[12px]" style={{ color: "#2C1810" }}>
                        picked
                      </Text>
                    </View>
                  ) : (
                    <Text className="font-manrope-bold" style={{ fontSize: 18, color: "#8A7570" }}>
                      →
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text
          className="font-manrope-semi tracking-[2px] uppercase mb-3"
          style={{ fontSize: 11, color: "#8A7570" }}
        >
          SUGGESTED TIMES
        </Text>
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
                className="rounded-2xl px-5 py-4 flex-row items-center"
                style={{
                  backgroundColor: selected ? GOLD : isTop ? GOLD_TINT : "#FFFFFF",
                  borderWidth: 1.5,
                  borderColor: selected ? GOLD : MUTED_BORDER,
                }}
              >
                <View className="flex-1 pr-3">
                  <Text className="font-manrope-bold text-foreground" style={{ fontSize: 16 }}>
                    {s.weekday}, {s.time}
                  </Text>
                  <Text
                    className="font-manrope mt-0.5"
                    style={{ fontSize: 13, color: "#8A7570" }}
                    numberOfLines={1}
                  >
                    {subtitle}
                  </Text>
                </View>
                <Text className="font-manrope-bold" style={{ fontSize: 18, color: "#8A7570" }}>
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
          <Text className="font-manrope" style={{ fontSize: 14, color: "#8A7570" }}>
            {customMode ? "Use a suggested time" : "Or propose another time"}
          </Text>
        </Pressable>

        {customMode && (
          <View className="mb-6 gap-3">
            <Pressable
              testID="date-input"
              onPress={() => setShowDatePicker(true)}
              className="rounded-2xl px-5 py-4"
              style={{ backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: MUTED_BORDER }}
            >
              <Text
                className="font-manrope-semi tracking-[2px] uppercase mb-1"
                style={{ fontSize: 11, color: "#8A7570" }}
              >
                DATE
              </Text>
              <Text
                className={`font-manrope-bold mt-0.5 ${customDate ? "text-foreground" : ""}`}
                style={{ fontSize: 16, color: customDate ? undefined : "#8A7570" }}
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

            <View
              className="rounded-2xl px-5 py-4"
              style={{ backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: MUTED_BORDER }}
            >
              <Text
                className="font-manrope-semi tracking-[2px] uppercase mb-1"
                style={{ fontSize: 11, color: "#8A7570" }}
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
                      className="rounded-xl px-4 py-2"
                      style={{
                        backgroundColor: customTime === slot ? GOLD : "#F5EFE8",
                        borderWidth: 1.5,
                        borderColor: customTime === slot ? GOLD : MUTED_BORDER,
                      }}
                    >
                      <Text
                        className="font-manrope-semi"
                        style={{ fontSize: 14, color: customTime === slot ? "#2C1810" : "#5C4A3F" }}
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
                  className="font-manrope-bold text-foreground"
                  style={{ fontSize: 16 }}
                  placeholderTextColor={MUTED_BORDER}
                />
              )}
            </View>
          </View>
        )}

        {error && (
          <View
            className="rounded-xl px-4 py-3 mb-4"
            style={{ backgroundColor: "#FDF0ED", borderWidth: 1, borderColor: "#C0876A" }}
          >
            <Text
              testID="proposal-error"
              className="font-manrope text-[13px]"
              style={{ color: "#C0876A" }}
            >
              {error}
            </Text>
          </View>
        )}

        <GoldButton
          onPress={handleSubmit}
          disabled={proposeMutation.isPending || venues.length === 0}
          loading={proposeMutation.isPending}
          label="Send proposal →"
        />
      </ScrollView>
    </View>
  );
}
