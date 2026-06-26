import DateTimePicker from "@react-native-community/datetimepicker";
import { Spinner } from "heroui-native";
import {
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
  useProposeFlow,
  useRescheduleFlow,
  useRespondFlow,
} from "@/hooks/use-meetup-flow";
import {
  combineLocal,
  formatDayTime,
  formatLongDate,
  formatLongDayDate,
  formatTime,
  toDate,
} from "@/lib/dates";

const GOLD = "#F2C94C";
const MUTED_BORDER = "#D9C9BC";
const DARK = "#2C1810";
const MUTED = "#8A7570";

export type MeetupFlowMode =
  | { type: "propose"; partnerId: string; partnerName: string }
  | { type: "respond"; meetupId?: string }
  | { type: "reschedule"; meetupId: string; currentVenueId: string; currentScheduledAt: Date | string };

// ── presentational sub-components ──────────────────────────────────────────────
// Behaviour (queries, mutations, validation, cascades) lives in
// `@/hooks/use-meetup-flow`; pure date/slot logic in `@/utils/meetup-flow`.

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
  const f = useProposeFlow({ partnerId, partnerName, onDismiss });

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
        venues={f.venues}
        loading={f.venuesLoading}
        selectedId={f.selectedVenueId}
        onSelect={f.selectVenue}
      />

      <Text className="font-manrope-semi tracking-[2px] uppercase mb-3" style={{ fontSize: 11, color: MUTED }}>
        SUGGESTED TIMES
      </Text>
      <View className="gap-3 mb-3">
        {f.suggestions.map((s, idx) => {
          const selected = !f.customMode && f.selectedSuggestionIdx === idx;
          const subtitle = s.isFree
            ? s.hint ? `Both free · ${s.hint}` : "Both free"
            : "Tap or pick another time";
          return (
            <TouchableOpacity
              key={`${s.date}-${s.time}`}
              testID="suggested-time-option"
              onPress={() => f.selectSuggestion(idx)}
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
        onPress={f.toggleCustomMode}
        className="self-center py-2 mb-4"
      >
        <Text className="font-manrope" style={{ fontSize: 14, color: MUTED }}>
          {f.customMode ? "Use a suggested time" : "Or propose another time"}
        </Text>
      </Pressable>

      {f.customMode && (
        <View className="mb-6 gap-3">
          <Pressable
            testID="date-input"
            onPress={() => f.setShowDatePicker(true)}
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
              style={{ fontSize: 16, color: f.customDate ? undefined : MUTED }}
            >
              {f.customDate ? formatLongDayDate(f.customDate) : "Select a date"}
            </Text>
          </Pressable>
          {f.showDatePicker && (
            <DateTimePicker
              testID="date-picker"
              value={f.customDate ?? new Date()}
              mode="date"
              minimumDate={new Date()}
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={(_event, picked) => {
                f.setShowDatePicker(Platform.OS === "ios");
                if (picked) f.pickCustomDate(picked);
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
            {f.customSlotsLoaded ? (
              <View className="flex flex-row flex-wrap gap-2 mt-1">
                {f.customFreeSlots.map((slot) => (
                  <TouchableOpacity
                    key={slot}
                    testID="time-slot"
                    onPress={() => f.setCustomTime(slot)}
                    className="rounded-xl px-4 py-2"
                    style={{
                      backgroundColor: f.customTime === slot ? GOLD : "#F5EFE8",
                      borderWidth: 1.5,
                      borderColor: f.customTime === slot ? GOLD : MUTED_BORDER,
                    }}
                  >
                    <Text
                      className="font-manrope-semi"
                      style={{ fontSize: 14, color: f.customTime === slot ? DARK : "#5C4A3F" }}
                    >
                      {slot}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <TextInput
                testID="time-input"
                value={f.customTime}
                onChangeText={(t) => { f.setCustomTime(t); f.clearError(); }}
                placeholder="14:00"
                className="font-manrope-bold text-foreground"
                style={{ fontSize: 16 }}
                placeholderTextColor={MUTED_BORDER}
              />
            )}
          </View>
        </View>
      )}

      <ErrorBanner error={f.error} testID="proposal-error" />
      <GoldButton
        onPress={f.submit}
        disabled={f.submitting || f.venues.length === 0}
        loading={f.submitting}
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
  const f = useRespondFlow({ meetupId: meetupIdProp, onDismiss });

  if (f.confirmed) {
    return (
      <MeetupConfirmedModal
        visible
        venueName={f.confirmed.venueName}
        scheduledAt={f.confirmed.scheduledAt}
        onDismiss={f.dismissConfirmed}
      />
    );
  }

  if (f.isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <Spinner />
      </View>
    );
  }

  if (!f.hasProposal || !f.proposal) {
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

  const proposal = f.proposal;

  if (f.counterMode) {
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
          venues={f.venues}
          loading={f.venuesLoading}
          selectedId={f.selectedVenueId}
          onSelect={f.selectVenue}
        />

        <Text className="font-manrope-semi text-[11px] tracking-[2px] uppercase mb-2" style={{ color: MUTED }}>
          Date
        </Text>
        <TouchableOpacity
          testID="counter-date-input"
          className="rounded-2xl px-5 py-4 mb-3"
          style={{ backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: MUTED_BORDER }}
          onPress={() => f.setShowDatePicker(true)}
        >
          <Text className="text-foreground font-manrope">
            {f.date ? formatLongDate(f.date) : "Select a date"}
          </Text>
        </TouchableOpacity>
        {f.showDatePicker && (
          <DateTimePicker
            testID="counter-date-picker"
            value={toDate(f.date) ?? new Date()}
            mode="date"
            minimumDate={new Date()}
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={(_event, picked) => {
              f.setShowDatePicker(Platform.OS === "ios");
              if (picked) f.pickCounterDate(picked);
            }}
          />
        )}

        <Text className="font-manrope-semi text-[11px] tracking-[2px] uppercase mb-2 mt-4" style={{ color: MUTED }}>
          Time
        </Text>
        {f.counterSlotsLoaded ? (
          <View className="flex flex-row flex-wrap gap-2 mb-6">
            {f.counterFreeSlots.map((slot) => (
              <TouchableOpacity
                key={slot}
                testID="time-slot"
                onPress={() => f.setTime(slot)}
                className="rounded-xl px-4 py-2"
                style={{
                  backgroundColor: f.time === slot ? GOLD : "#F5EFE8",
                  borderWidth: 1.5,
                  borderColor: f.time === slot ? GOLD : MUTED_BORDER,
                }}
              >
                <Text
                  className="font-manrope-semi"
                  style={{ fontSize: 14, color: f.time === slot ? DARK : "#5C4A3F" }}
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

        <ErrorBanner error={f.error} testID="counter-error" />
        <GoldButton
          testID="submit-counter-btn"
          onPress={f.submitCounter}
          disabled={f.isPending}
          loading={f.countering}
          label="Send counter-proposal →"
        />
        <Pressable
          onPress={f.exitCounter}
          className="items-center py-4"
        >
          <Text className="font-manrope" style={{ fontSize: 14, color: MUTED }}>Back</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const proposalScheduled = f.proposalScheduled;

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

      <ErrorBanner error={f.error} testID="response-error" />
      <View className="gap-3">
        <GoldButton
          testID="accept-btn"
          onPress={f.accept}
          disabled={f.isPending}
          loading={f.accepting}
          label={f.accepting ? "Accepting…" : "Accept →"}
        />
        {proposal.canCounterPropose && (
          <Pressable
            testID="counter-propose-btn"
            onPress={f.startCounter}
            disabled={f.isPending}
            className="rounded-full items-center"
            style={{ paddingVertical: 18, backgroundColor: "#F5EFE8", borderWidth: 1.5, borderColor: MUTED_BORDER }}
          >
            <Text className="font-manrope-bold" style={{ fontSize: 17, color: DARK }}>Counter-propose</Text>
          </Pressable>
        )}
        <Pressable
          testID="decline-btn"
          onPress={f.decline}
          disabled={f.isPending}
          className="items-center py-4"
        >
          <Text className="font-manrope" style={{ fontSize: 14, color: MUTED }}>
            {f.declining ? "Declining…" : "Decline"}
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
  const f = useRescheduleFlow({ meetupId, currentVenueId, currentScheduledAt, onDismiss });

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
      {f.venuesLoading ? (
        <View className="items-center py-6"><Spinner /></View>
      ) : (
        <View className="gap-3 mb-6">
          {f.venues.map((v) => (
            <TouchableOpacity
              key={v.id}
              testID="reschedule-venue-option"
              onPress={() => f.selectVenue(v.id)}
              activeOpacity={0.85}
              className="rounded-2xl px-5 py-4 flex-row items-center"
              style={{
                backgroundColor: "#FFFFFF",
                borderWidth: f.venueId === v.id ? 2 : 1.5,
                borderColor: f.venueId === v.id ? GOLD : MUTED_BORDER,
              }}
            >
              <View className="flex-1 pr-3">
                <Text className="font-manrope-bold text-foreground" style={{ fontSize: 16 }}>{v.name}</Text>
              </View>
              {f.venueId === v.id ? (
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
        onPress={() => f.setShowDatePicker(true)}
      >
        <Text className="font-manrope text-foreground">
          {f.date ? formatLongDayDate(f.date) : "Select a date"}
        </Text>
      </TouchableOpacity>
      {f.showDatePicker && (
        <DateTimePicker
          testID="reschedule-date-picker"
          value={toDate(f.date) ?? new Date()}
          mode="date"
          minimumDate={new Date()}
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(_event, picked) => {
            f.setShowDatePicker(Platform.OS === "ios");
            if (picked) f.pickDate(picked);
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
        onPress={() => f.setShowTimePicker(true)}
      >
        <Text className="font-manrope text-foreground">{f.time ? formatTime(combineLocal(f.date || "2000-01-01", f.time)) : "Select a time"}</Text>
      </TouchableOpacity>
      {f.showTimePicker && (
        <DateTimePicker
          testID="reschedule-time-picker"
          value={(f.time ? combineLocal(f.date || "2000-01-01", f.time) : null) ?? new Date()}
          mode="time"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(_event, picked) => {
            f.setShowTimePicker(Platform.OS === "ios");
            if (picked) f.pickTime(picked);
          }}
        />
      )}

      <ErrorBanner error={f.error} testID="reschedule-error" />
      <GoldButton
        testID="reschedule-submit-btn"
        onPress={f.submit}
        disabled={f.submitting}
        loading={f.submitting}
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
