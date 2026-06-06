import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { addDays, startOfDay } from "date-fns";
import { Spinner } from "heroui-native";
import { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MeetupConfirmedModal } from "@/components/meetup-confirmed-modal";
import {
  combineLocal,
  dayBoundsIso,
  formatDayFull,
  formatDayTime,
  formatLongDate,
  formatLongDayDate,
  formatTime,
  isFuture,
  toDate,
  toIsoDate,
} from "@/lib/dates";
import { trpc, queryClient } from "@/utils/trpc";

const GOLD = "#F2C94C";
const MUTED_BORDER = "#D9C9BC";
const DARK = "#2C1810";
const MUTED = "#8A7570";

export type MeetupFlowMode =
  | { type: "propose"; partnerId: string; partnerName: string }
  | { type: "respond"; meetupId?: string }
  | { type: "reschedule"; meetupId: string; currentVenueId: string; currentScheduledAt: Date | string };

// ── shared helpers ────────────────────────────────────────────────────────────

/** All bookable half-hour slots from 08:00 to 20:00 (wall-clock in device tz). */
const ALL_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const totalMinutes = 8 * 60 + i * 30;
  const h = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const m = String(totalMinutes % 60).padStart(2, "0");
  return `${h}:${m}`;
});

type Suggestion = { date: string; time: string; weekday: string; hint?: string };

function timeFromDate(d: Date): string {
  return formatTime(d);
}

function buildSuggestions(): Suggestion[] {
  const today = startOfDay(new Date());
  const offsets = [1, 2, 4];
  const times = ["10:30", "14:00", "15:00"];
  const hints = ["your usual coffee slot", undefined, undefined];
  return offsets.map((off, i) => {
    const d = addDays(today, off);
    return {
      date: toIsoDate(d),
      time: times[i] ?? "10:30",
      weekday: formatDayFull(d),
      hint: hints[i],
    };
  });
}

function GoldButton({
  onPress, disabled, label, loading, testID,
}: { onPress: () => void; disabled?: boolean; label: string; loading?: boolean; testID?: string }) {
  return (
    <Pressable
      testID={testID}
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
        style={{ color: (disabled || loading) ? MUTED : DARK }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ErrorBanner({ error, testID }: { error: string | null; testID?: string }) {
  if (!error) return null;
  return (
    <View
      className="rounded-xl px-4 py-3 mb-4"
      style={{ backgroundColor: "#FDF0ED", borderWidth: 1, borderColor: "#C0876A" }}
    >
      <Text testID={testID} className="font-manrope text-[13px]" style={{ color: "#C0876A" }}>
        {error}
      </Text>
    </View>
  );
}

function VenuePicker({
  venues,
  loading,
  selectedId,
  onSelect,
}: {
  venues: { id: string; name: string; description?: string | null }[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (loading) return <View className="items-center py-6"><Spinner /></View>;
  if (venues.length === 0) {
    return (
      <View
        className="rounded-2xl px-5 py-4 mb-6"
        style={{ backgroundColor: "#F5EFE8", borderWidth: 1.5, borderColor: MUTED_BORDER }}
      >
        <Text className="font-manrope text-[14px]" style={{ color: MUTED }}>
          No venues available at the moment. Check back soon.
        </Text>
      </View>
    );
  }
  return (
    <View className="gap-3 mb-6">
      {venues.map((v) => {
        const picked = selectedId === v.id;
        return (
          <TouchableOpacity
            key={v.id}
            testID="venue-option"
            onPress={() => onSelect(v.id)}
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
                  style={{ fontSize: 13, color: MUTED }}
                  numberOfLines={1}
                >
                  {v.description}
                </Text>
              ) : null}
            </View>
            {picked ? (
              <View className="rounded-full px-3 py-1" style={{ backgroundColor: GOLD }}>
                <Text className="font-manrope-semi text-[12px]" style={{ color: DARK }}>picked</Text>
              </View>
            ) : (
              <Text className="font-manrope-bold" style={{ fontSize: 18, color: MUTED }}>→</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Given a list of blocked UTC instants (Date|string), return the HH:MM slots
 *  on `date` (local) that don't collide. Used to render the slot picker. */
function freeSlotsFor(date: string, blocked: Array<Date | string>): string[] {
  const blockedMs = new Set(
    blocked.map((b) => toDate(b)?.getTime()).filter((n): n is number => typeof n === "number"),
  );
  return ALL_SLOTS.filter((slot) => {
    const at = combineLocal(date, slot);
    return at !== null && !blockedMs.has(at.getTime());
  });
}

// ── propose content ───────────────────────────────────────────────────────────

export function ProposeContent({
  partnerId,
  partnerName,
  onDismiss,
}: {
  partnerId: string;
  partnerName: string;
  onDismiss: () => void;
}) {
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
    queries: suggestions.map((s) => {
      const bounds = dayBoundsIso(s.date);
      return trpc.meetup.getAvailableSlots.queryOptions(
        { partnerId, startIso: bounds?.startIso ?? "", endIso: bounds?.endIso ?? "" },
        { enabled: !!partnerId && !!bounds },
      );
    }),
  });

  const customDateIso = customDate ? toIsoDate(customDate) : "";
  const customBounds = customDateIso ? dayBoundsIso(customDateIso) : null;
  const customSlotsQuery = useQuery(
    trpc.meetup.getAvailableSlots.queryOptions(
      { partnerId, startIso: customBounds?.startIso ?? "", endIso: customBounds?.endIso ?? "" },
      { enabled: !!partnerId && !!customBounds },
    ),
  );

  const proposeMutation = useMutation(
    trpc.meetup.propose.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.meetup.list.queryOptions({ status: "pending" }));
        void queryClient.invalidateQueries(trpc.matching.getMyMatches.queryOptions());
        Alert.alert(
          "Proposal sent!",
          `Your meetup proposal has been sent to ${partnerName}.`,
          [{ text: "OK", onPress: onDismiss }],
        );
      },
      onError: (err) => setError(err.message),
    }),
  );

  function pickedScheduledAt(): Date | null {
    if (customMode) {
      if (!customDateIso || !customTime.match(/^\d{2}:\d{2}$/)) return null;
      return combineLocal(customDateIso, customTime);
    }
    if (selectedSuggestionIdx === null) return null;
    const s = suggestions[selectedSuggestionIdx];
    return s ? combineLocal(s.date, s.time) : null;
  }

  function handleSubmit() {
    setError(null);
    if (!selectedVenueId) { setError("Please pick a venue"); return; }
    const dt = pickedScheduledAt();
    if (!dt) {
      setError(customMode ? "Please pick a date and time (HH:MM)" : "Please pick a suggested time");
      return;
    }
    if (!isFuture(dt)) { setError("The selected date and time must be in the future"); return; }
    proposeMutation.mutate({ partnerId, venueId: selectedVenueId, scheduledAt: dt.toISOString() });
  }

  const venues = venuesQuery.data ?? [];
  const customFreeSlots = customDateIso ? freeSlotsFor(customDateIso, customSlotsQuery.data ?? []) : [];

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
    >
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
          with {partnerName}
        </Text>
      </View>

      <Text className="font-manrope-semi tracking-[2px] uppercase mb-3" style={{ fontSize: 11, color: MUTED }}>
        PICK A VENUE
      </Text>
      <VenuePicker
        venues={venues}
        loading={venuesQuery.isPending}
        selectedId={selectedVenueId}
        onSelect={setSelectedVenueId}
      />

      <Text className="font-manrope-semi tracking-[2px] uppercase mb-3" style={{ fontSize: 11, color: MUTED }}>
        SUGGESTED TIMES
      </Text>
      <View className="gap-3 mb-3">
        {suggestions.map((s, idx) => {
          const blocked = slotChecks[idx]?.data ?? [];
          const free = freeSlotsFor(s.date, blocked);
          const isFree = free.includes(s.time);
          const selected = !customMode && selectedSuggestionIdx === idx;
          const subtitle = isFree
            ? s.hint ? `Both free · ${s.hint}` : "Both free"
            : "Tap or pick another time";
          return (
            <TouchableOpacity
              key={`${s.date}-${s.time}`}
              testID="suggested-time-option"
              onPress={() => { setCustomMode(false); setSelectedSuggestionIdx(idx); setError(null); }}
              activeOpacity={0.85}
              className="rounded-2xl px-5 py-4 flex-row items-center"
              style={{
                backgroundColor: selected ? GOLD : "#FFFFFF",
                borderWidth: 1.5,
                borderColor: selected ? GOLD : MUTED_BORDER,
              }}
            >
              <View className="flex-1 pr-3">
                <Text className="font-manrope-bold text-foreground" style={{ fontSize: 16 }}>
                  {s.weekday}, {s.time}
                </Text>
                <Text className="font-manrope mt-0.5" style={{ fontSize: 13, color: MUTED }} numberOfLines={1}>
                  {subtitle}
                </Text>
              </View>
              <Text className="font-manrope-bold" style={{ fontSize: 18, color: MUTED }}>→</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Pressable
        testID="propose-another-time"
        onPress={() => { setCustomMode((m) => !m); setSelectedSuggestionIdx(null); setError(null); }}
        className="self-center py-2 mb-4"
      >
        <Text className="font-manrope" style={{ fontSize: 14, color: MUTED }}>
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
              style={{ fontSize: 11, color: MUTED }}
            >
              DATE
            </Text>
            <Text
              className="font-manrope-bold mt-0.5"
              style={{ fontSize: 16, color: customDate ? undefined : MUTED }}
            >
              {customDate ? formatLongDayDate(customDate) : "Select a date"}
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
                if (picked) { setCustomDate(picked); setError(null); }
              }}
            />
          )}

          <View
            className="rounded-2xl px-5 py-4"
            style={{ backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: MUTED_BORDER }}
          >
            <Text
              className="font-manrope-semi tracking-[2px] uppercase mb-1"
              style={{ fontSize: 11, color: MUTED }}
            >
              TIME
            </Text>
            {customDateIso && customSlotsQuery.data ? (
              <View className="flex flex-row flex-wrap gap-2 mt-1">
                {customFreeSlots.map((slot) => (
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
                      style={{ fontSize: 14, color: customTime === slot ? DARK : "#5C4A3F" }}
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
                onChangeText={(t) => { setCustomTime(t); setError(null); }}
                placeholder="14:00"
                className="font-manrope-bold text-foreground"
                style={{ fontSize: 16 }}
                placeholderTextColor={MUTED_BORDER}
              />
            )}
          </View>
        </View>
      )}

      <ErrorBanner error={error} testID="proposal-error" />
      <GoldButton
        onPress={handleSubmit}
        disabled={proposeMutation.isPending || venues.length === 0}
        loading={proposeMutation.isPending}
        label="Send proposal →"
      />
    </ScrollView>
  );
}

// ── respond content ───────────────────────────────────────────────────────────

export function RespondContent({
  meetupId: meetupIdProp,
  onDismiss,
}: {
  meetupId?: string;
  onDismiss: () => void;
}) {
  const [counterMode, setCounterMode] = useState(false);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ venueName: string; scheduledAt: Date | string } | null>(null);

  const proposalQuery = useQuery(trpc.meetup.getPendingIncoming.queryOptions());
  const venuesQuery = useQuery(trpc.venue.listForPicker.queryOptions());
  const counterBounds = date ? dayBoundsIso(date) : null;
  const slotsQuery = useQuery(
    trpc.meetup.getAvailableSlots.queryOptions(
      {
        partnerId: proposalQuery.data?.proposer.id ?? "",
        startIso: counterBounds?.startIso ?? "",
        endIso: counterBounds?.endIso ?? "",
      },
      { enabled: !!proposalQuery.data?.proposer.id && !!counterBounds },
    ),
  );

  const proposal = proposalQuery.data;
  const activeMeetupId = meetupIdProp ?? proposal?.meetupId;

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
          setConfirmed({ venueName: proposal.venue.name, scheduledAt: proposal.scheduledAt });
        } else {
          onDismiss();
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
        onDismiss();
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
            [{ text: "OK", onPress: onDismiss }],
          );
        } else {
          Alert.alert("Proposal declined", "The proposal has been declined.");
          onDismiss();
        }
      },
      onError: (err) => setError(err.message),
    }),
  );

  if (confirmed) {
    return (
      <MeetupConfirmedModal
        visible
        venueName={confirmed.venueName}
        scheduledAt={confirmed.scheduledAt}
        onDismiss={() => { setConfirmed(null); onDismiss(); }}
      />
    );
  }

  if (proposalQuery.isPending) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <Spinner />
      </View>
    );
  }

  if (!proposal || !activeMeetupId) {
    return (
      <View testID="no-proposal-state" className="flex-1 items-center justify-center p-6 py-20">
        <Text className="text-foreground text-lg font-manrope-bold text-center mb-2">
          No incoming proposals
        </Text>
        <Text className="text-muted-foreground font-manrope text-center">
          There are no pending meetup proposals waiting for your response.
        </Text>
      </View>
    );
  }

  const isPending = acceptMutation.isPending || counterMutation.isPending || declineMutation.isPending;

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
    const proposed = combineLocal(date, time);
    if (!proposed) { setError("Enter a valid date and time"); return; }
    if (!isFuture(proposed)) { setError("Date and time must be in the future"); return; }
    counterMutation.mutate({
      meetupId: activeMeetupId!,
      venueId: selectedVenueId,
      scheduledAt: proposed.toISOString(),
    });
  }

  const counterFreeSlots = date ? freeSlotsFor(date, slotsQuery.data ?? []) : [];

  if (counterMode) {
    return (
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }}>
        <Text className="text-foreground text-2xl font-manrope-bold mb-1">Counter-propose</Text>
        <Text testID="counter-round-label" className="text-muted-foreground font-manrope text-sm mb-6">
          Round {proposal.round + 1} of 5
        </Text>

        <Text className="font-manrope-semi text-[11px] tracking-[2px] uppercase mb-3" style={{ color: MUTED }}>
          Location
        </Text>
        <VenuePicker
          venues={venuesQuery.data ?? []}
          loading={venuesQuery.isPending}
          selectedId={selectedVenueId}
          onSelect={setSelectedVenueId}
        />

        <Text className="font-manrope-semi text-[11px] tracking-[2px] uppercase mb-2" style={{ color: MUTED }}>
          Date
        </Text>
        <TouchableOpacity
          testID="counter-date-input"
          className="rounded-2xl px-5 py-4 mb-3"
          style={{ backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: MUTED_BORDER }}
          onPress={() => setShowDatePicker(true)}
        >
          <Text className="text-foreground font-manrope">
            {date ? formatLongDate(date) : "Select a date"}
          </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            testID="counter-date-picker"
            value={toDate(date) ?? new Date()}
            mode="date"
            minimumDate={new Date()}
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={(_event, picked) => {
              setShowDatePicker(Platform.OS === "ios");
              if (picked) {
                setDate(toIsoDate(picked));
                setError(null);
              }
            }}
          />
        )}

        <Text className="font-manrope-semi text-[11px] tracking-[2px] uppercase mb-2 mt-4" style={{ color: MUTED }}>
          Time
        </Text>
        {date && slotsQuery.data ? (
          <View className="flex flex-row flex-wrap gap-2 mb-6">
            {counterFreeSlots.map((slot) => (
              <TouchableOpacity
                key={slot}
                testID="time-slot"
                onPress={() => setTime(slot)}
                className="rounded-xl px-4 py-2"
                style={{
                  backgroundColor: time === slot ? GOLD : "#F5EFE8",
                  borderWidth: 1.5,
                  borderColor: time === slot ? GOLD : MUTED_BORDER,
                }}
              >
                <Text
                  className="font-manrope-semi"
                  style={{ fontSize: 14, color: time === slot ? DARK : "#5C4A3F" }}
                >
                  {slot}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text className="text-muted-foreground font-manrope text-sm mb-6">
            Select a date to see available time slots
          </Text>
        )}

        <ErrorBanner error={error} testID="counter-error" />
        <GoldButton
          testID="submit-counter-btn"
          onPress={handleCounterSubmit}
          disabled={isPending}
          loading={counterMutation.isPending}
          label="Send counter-proposal →"
        />
        <Pressable
          onPress={() => { setCounterMode(false); setError(null); setShowDatePicker(false); }}
          className="items-center py-4"
        >
          <Text className="font-manrope" style={{ fontSize: 14, color: MUTED }}>Back</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const proposalScheduled = toDate(proposal.scheduledAt);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }}>
      <Text className="text-foreground text-2xl font-manrope-bold mb-1">Meetup proposal</Text>
      <Text testID="round-label" className="text-muted-foreground font-manrope text-sm mb-6">
        Round {proposal.round} of 5
      </Text>

      <View
        className="rounded-2xl p-4 mb-6"
        style={{ backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: MUTED_BORDER }}
      >
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
            <Text className="text-muted-foreground font-manrope text-sm w-20">When</Text>
            <Text testID="proposal-datetime" className="text-foreground font-manrope-semi flex-1">
              {formatDayTime(proposalScheduled)}
            </Text>
          </View>
        </View>
      </View>

      <ErrorBanner error={error} testID="response-error" />
      <View className="gap-3">
        <GoldButton
          testID="accept-btn"
          onPress={handleAccept}
          disabled={isPending}
          loading={acceptMutation.isPending}
          label={acceptMutation.isPending ? "Accepting…" : "Accept →"}
        />
        {proposal.canCounterPropose && (
          <Pressable
            testID="counter-propose-btn"
            onPress={() => {
              const at = proposalScheduled ?? new Date();
              setSelectedVenueId(proposal.venue.id);
              setDate(toIsoDate(at));
              setTime(timeFromDate(at));
              setCounterMode(true);
            }}
            disabled={isPending}
            className="rounded-full items-center"
            style={{ paddingVertical: 18, backgroundColor: "#F5EFE8", borderWidth: 1.5, borderColor: MUTED_BORDER }}
          >
            <Text className="font-manrope-bold" style={{ fontSize: 17, color: DARK }}>Counter-propose</Text>
          </Pressable>
        )}
        <Pressable
          testID="decline-btn"
          onPress={handleDecline}
          disabled={isPending}
          className="items-center py-4"
        >
          <Text className="font-manrope" style={{ fontSize: 14, color: MUTED }}>
            {declineMutation.isPending ? "Declining…" : "Decline"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ── reschedule content ────────────────────────────────────────────────────────

function RescheduleContent({
  meetupId,
  currentVenueId,
  currentScheduledAt,
  onDismiss,
}: {
  meetupId: string;
  currentVenueId: string;
  currentScheduledAt: Date | string;
  onDismiss: () => void;
}) {
  const initial = toDate(currentScheduledAt) ?? new Date();
  const [venueId, setVenueId] = useState(currentVenueId);
  const [date, setDate] = useState(toIsoDate(initial));
  const [time, setTime] = useState(timeFromDate(initial));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const venuesQuery = useQuery(trpc.venue.listForPicker.queryOptions());

  const rescheduleMutation = useMutation(
    trpc.meetup.proposeReschedule.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.meetup.getConfirmed.queryOptions());
        Alert.alert(
          "Reschedule proposed",
          "Your reschedule request has been sent to your buddy.",
          [{ text: "OK", onPress: onDismiss }],
        );
      },
      onError: (err) => setError(err.message),
    }),
  );

  function handleSubmit() {
    setError(null);
    if (!venueId) { setError("Please select a location"); return; }
    const proposed = combineLocal(date, time);
    if (!proposed) { setError("Enter a valid date and time"); return; }
    if (!isFuture(proposed)) { setError("Date and time must be in the future"); return; }
    rescheduleMutation.mutate({ meetupId, venueId, scheduledAt: proposed.toISOString() });
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="mb-6">
        <Text
          className="font-manrope-semi tracking-[2px] uppercase mb-1"
          style={{ fontSize: 11, color: GOLD }}
        >
          CHANGE PLANS
        </Text>
        <Text className="font-caveat text-foreground" style={{ fontSize: 36 }}>
          Reschedule meetup
        </Text>
      </View>

      <Text className="font-manrope-semi tracking-[2px] uppercase mb-3" style={{ fontSize: 11, color: MUTED }}>
        PICK A VENUE
      </Text>
      {venuesQuery.isPending ? (
        <View className="items-center py-6"><Spinner /></View>
      ) : (
        <View className="gap-3 mb-6">
          {(venuesQuery.data ?? []).map((v) => (
            <TouchableOpacity
              key={v.id}
              testID="reschedule-venue-option"
              onPress={() => setVenueId(v.id)}
              activeOpacity={0.85}
              className="rounded-2xl px-5 py-4 flex-row items-center"
              style={{
                backgroundColor: "#FFFFFF",
                borderWidth: venueId === v.id ? 2 : 1.5,
                borderColor: venueId === v.id ? GOLD : MUTED_BORDER,
              }}
            >
              <View className="flex-1 pr-3">
                <Text className="font-manrope-bold text-foreground" style={{ fontSize: 16 }}>{v.name}</Text>
              </View>
              {venueId === v.id ? (
                <View className="rounded-full px-3 py-1" style={{ backgroundColor: GOLD }}>
                  <Text className="font-manrope-semi text-[12px]" style={{ color: DARK }}>picked</Text>
                </View>
              ) : (
                <Text className="font-manrope-bold" style={{ fontSize: 18, color: MUTED }}>→</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text className="font-manrope-semi tracking-[2px] uppercase mb-2" style={{ fontSize: 11, color: MUTED }}>
        DATE
      </Text>
      <TouchableOpacity
        testID="reschedule-date-input"
        className="rounded-2xl px-5 py-4 mb-4"
        style={{ backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: MUTED_BORDER }}
        onPress={() => setShowDatePicker(true)}
      >
        <Text className="font-manrope text-foreground">
          {date ? formatLongDayDate(date) : "Select a date"}
        </Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          testID="reschedule-date-picker"
          value={toDate(date) ?? new Date()}
          mode="date"
          minimumDate={new Date()}
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(_event, picked) => {
            setShowDatePicker(Platform.OS === "ios");
            if (picked) {
              setDate(toIsoDate(picked));
            }
          }}
        />
      )}

      <Text className="font-manrope-semi tracking-[2px] uppercase mb-2 mt-2" style={{ fontSize: 11, color: MUTED }}>
        TIME
      </Text>
      <TouchableOpacity
        testID="reschedule-time-input"
        className="rounded-2xl px-5 py-4 mb-6"
        style={{ backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: MUTED_BORDER }}
        onPress={() => setShowTimePicker(true)}
      >
        <Text className="font-manrope text-foreground">{time ? formatTime(combineLocal(date || "2000-01-01", time)) : "Select a time"}</Text>
      </TouchableOpacity>
      {showTimePicker && (
        <DateTimePicker
          testID="reschedule-time-picker"
          value={time ? new Date(`1970-01-01T${time}:00`) : new Date()}
          mode="time"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(_event, picked) => {
            setShowTimePicker(Platform.OS === "ios");
            if (picked) {
              setTime(timeFromDate(picked));
            }
          }}
        />
      )}

      <ErrorBanner error={error} testID="reschedule-error" />
      <GoldButton
        testID="reschedule-submit-btn"
        onPress={handleSubmit}
        disabled={rescheduleMutation.isPending}
        loading={rescheduleMutation.isPending}
        label="Propose reschedule →"
      />
      <Pressable onPress={onDismiss} className="items-center py-4">
        <Text className="font-manrope" style={{ fontSize: 14, color: MUTED }}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

// ── modal wrapper ─────────────────────────────────────────────────────────────

export function MeetupFlowModal({
  mode,
  onDismiss,
}: {
  mode: MeetupFlowMode | null;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={!!mode}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: 8, paddingBottom: insets.bottom }}
      >
        <View className="px-6 pb-4 flex-row justify-end">
          <Pressable
            onPress={onDismiss}
            className="items-center justify-center rounded-full"
            style={{ width: 36, height: 36, backgroundColor: "#F0E5DA" }}
          >
            <Text className="font-manrope-bold" style={{ fontSize: 16, color: MUTED }}>✕</Text>
          </Pressable>
        </View>

        {mode?.type === "propose" && (
          <ProposeContent
            partnerId={mode.partnerId}
            partnerName={mode.partnerName}
            onDismiss={onDismiss}
          />
        )}
        {mode?.type === "respond" && (
          <RespondContent meetupId={mode.meetupId} onDismiss={onDismiss} />
        )}
        {mode?.type === "reschedule" && (
          <RescheduleContent
            meetupId={mode.meetupId}
            currentVenueId={mode.currentVenueId}
            currentScheduledAt={mode.currentScheduledAt}
            onDismiss={onDismiss}
          />
        )}
      </View>
    </Modal>
  );
}
