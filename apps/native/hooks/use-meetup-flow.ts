/**
 * Headless meetup-flow view-models — the behaviour behind `MeetupFlowModal`.
 *
 * `meetup-flow-modal.tsx` is the presentation: JSX, styling, and the small
 * pieces of UI-only state (which native picker is open). Everything with a bug
 * surface — the tRPC queries that feed the screens, the mutation cascades
 * (which queries get invalidated, which alert fires, whether the modal
 * dismisses or shows the confirmation), the validate→guard→submit sequencing,
 * the positional join between the slot-availability queries and the suggested
 * times, and the counter-propose pre-fill — lives here, behind a small
 * per-flow interface, so it can be driven by `renderHook` without rendering a
 * single `View`.
 *
 * Mirrors the split already made for the pure rules in `@/utils/meetup-flow`
 * (which this consumes) and for `use-notification-tap-handler`: the component
 * owns pixels, the hook owns behaviour. Server stays the source of truth for
 * eligibility, round limits, and real slot availability — these hooks only
 * orchestrate the client calls and the local date/slot math.
 */
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert } from "react-native";

import { dayBoundsIso, toDate, toIsoDate } from "@/lib/dates";
import {
  buildSuggestions,
  freeSlotsFor,
  timeFromDate,
  validateProposedScheduledAt,
  validateScheduledAt,
  type Suggestion,
} from "@/utils/meetup-flow";
import { queryClient, trpc } from "@/utils/trpc";

/** A suggested-time card with its computed both-free availability. */
export type SuggestionCard = Suggestion & { isFree: boolean };

// ── propose flow ────────────────────────────────────────────────────────────

export type UseProposeFlowArgs = {
  partnerId: string;
  partnerName: string;
  onDismiss: () => void;
};

/**
 * View-model for the "Plan a sip" screen. Owns venue + per-suggestion slot
 * queries, the custom date/time selection, validation, and the propose
 * mutation cascade (invalidate pending list + matches, alert, dismiss).
 */
export function useProposeFlow({ partnerId, partnerName, onDismiss }: UseProposeFlowArgs) {
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

  const venues = venuesQuery.data ?? [];

  // Suggested-time cards carry their availability so the JSX never has to index
  // `slotChecks` by position (the fragile half of the old inline render).
  const suggestionCards: SuggestionCard[] = suggestions.map((s, idx) => {
    const blocked = slotChecks[idx]?.data ?? [];
    return { ...s, isFree: freeSlotsFor(s.date, blocked).includes(s.time) };
  });

  const customSlotsLoaded = !!(customDateIso && customSlotsQuery.data);
  const customFreeSlots = customDateIso
    ? freeSlotsFor(customDateIso, customSlotsQuery.data ?? [])
    : [];

  function clearError() {
    setError(null);
  }

  function selectVenue(id: string) {
    setSelectedVenueId(id);
  }

  /** Pick a suggested time: leaves custom mode, selects it, clears any error. */
  function selectSuggestion(idx: number) {
    setCustomMode(false);
    setSelectedSuggestionIdx(idx);
    setError(null);
  }

  /** Toggle the "propose another time" custom panel. */
  function toggleCustomMode() {
    setCustomMode((m) => !m);
    setSelectedSuggestionIdx(null);
    setError(null);
  }

  function pickCustomDate(date: Date) {
    setCustomDate(date);
    setError(null);
  }

  function submit() {
    setError(null);
    if (!selectedVenueId) {
      setError("Please pick a venue");
      return;
    }
    const result = validateProposedScheduledAt({
      customMode,
      customDateIso,
      customTime,
      selectedSuggestionIdx,
      suggestions,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    proposeMutation.mutate({
      partnerId,
      venueId: selectedVenueId,
      scheduledAt: result.scheduledAt.toISOString(),
    });
  }

  return {
    partnerName,
    venues,
    venuesLoading: venuesQuery.isPending,
    selectedVenueId,
    selectVenue,
    suggestions: suggestionCards,
    selectedSuggestionIdx,
    customMode,
    selectSuggestion,
    toggleCustomMode,
    customDate,
    pickCustomDate,
    showDatePicker,
    setShowDatePicker,
    customSlotsLoaded,
    customFreeSlots,
    customTime,
    setCustomTime,
    clearError,
    error,
    submit,
    submitting: proposeMutation.isPending,
  };
}

// ── respond / counter-propose flow ──────────────────────────────────────────

export type UseRespondFlowArgs = {
  meetupId?: string;
  onDismiss: () => void;
};

/**
 * View-model for the incoming-proposal screen and its counter-propose sub-flow.
 * Owns the proposal + venue + slot queries, the three mutations
 * (accept/counter/decline) with their distinct cascades — including decline's
 * branch on `canCounterPropose` and accept's confirmation-vs-dismiss branch —
 * and the counter pre-fill from the live proposal.
 */
export function useRespondFlow({ meetupId: meetupIdProp, onDismiss }: UseRespondFlowArgs) {
  const [counterMode, setCounterMode] = useState(false);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ venueName: string; scheduledAt: Date | string } | null>(
    null,
  );

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

  const isPending =
    acceptMutation.isPending || counterMutation.isPending || declineMutation.isPending;

  const proposalScheduled = proposal ? toDate(proposal.scheduledAt) : null;
  const counterFreeSlots = date ? freeSlotsFor(date, slotsQuery.data ?? []) : [];
  const counterSlotsLoaded = !!(date && slotsQuery.data);

  function dismissConfirmed() {
    setConfirmed(null);
    onDismiss();
  }

  function selectVenue(id: string) {
    setSelectedVenueId(id);
  }

  function pickCounterDate(picked: Date) {
    setDate(toIsoDate(picked));
    setError(null);
  }

  /** Enter the counter-propose panel, pre-filled from the live proposal. */
  function startCounter() {
    if (!proposal) return;
    const at = proposalScheduled ?? new Date();
    setSelectedVenueId(proposal.venue.id);
    setDate(toIsoDate(at));
    setTime(timeFromDate(at));
    setCounterMode(true);
  }

  function exitCounter() {
    setCounterMode(false);
    setError(null);
    setShowDatePicker(false);
  }

  function accept() {
    setError(null);
    if (!activeMeetupId) return;
    acceptMutation.mutate({ meetupId: activeMeetupId });
  }

  function decline() {
    setError(null);
    if (!activeMeetupId) return;
    Alert.alert(
      "Decline proposal",
      "Are you sure you want to decline this meetup proposal?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: () => declineMutation.mutate({ meetupId: activeMeetupId }),
        },
      ],
    );
  }

  function submitCounter() {
    setError(null);
    if (!activeMeetupId) return;
    if (!selectedVenueId) {
      setError("Please select a location");
      return;
    }
    const result = validateScheduledAt(date, time);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    counterMutation.mutate({
      meetupId: activeMeetupId,
      venueId: selectedVenueId,
      scheduledAt: result.scheduledAt.toISOString(),
    });
  }

  return {
    isLoading: proposalQuery.isPending,
    proposal,
    hasProposal: !!proposal && !!activeMeetupId,
    proposalScheduled,
    confirmed,
    dismissConfirmed,
    counterMode,
    startCounter,
    exitCounter,
    venues: venuesQuery.data ?? [],
    venuesLoading: venuesQuery.isPending,
    selectedVenueId,
    selectVenue,
    date,
    time,
    setTime,
    pickCounterDate,
    showDatePicker,
    setShowDatePicker,
    counterFreeSlots,
    counterSlotsLoaded,
    error,
    isPending,
    accepting: acceptMutation.isPending,
    countering: counterMutation.isPending,
    declining: declineMutation.isPending,
    accept,
    decline,
    submitCounter,
  };
}

// ── reschedule flow ──────────────────────────────────────────────────────────

export type UseRescheduleFlowArgs = {
  meetupId: string;
  currentVenueId: string;
  currentScheduledAt: Date | string;
  onDismiss: () => void;
};

/**
 * View-model for the reschedule screen. Seeds venue/date/time from the current
 * meetup, owns the proposeReschedule mutation cascade (invalidate confirmed,
 * alert, dismiss), and the validate→guard→submit sequencing.
 */
export function useRescheduleFlow({
  meetupId,
  currentVenueId,
  currentScheduledAt,
  onDismiss,
}: UseRescheduleFlowArgs) {
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

  function selectVenue(id: string) {
    setVenueId(id);
  }

  function pickDate(picked: Date) {
    setDate(toIsoDate(picked));
  }

  function pickTime(picked: Date) {
    setTime(timeFromDate(picked));
  }

  function submit() {
    setError(null);
    if (!venueId) {
      setError("Please select a location");
      return;
    }
    const result = validateScheduledAt(date, time);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    rescheduleMutation.mutate({ meetupId, venueId, scheduledAt: result.scheduledAt.toISOString() });
  }

  return {
    venues: venuesQuery.data ?? [],
    venuesLoading: venuesQuery.isPending,
    venueId,
    selectVenue,
    date,
    pickDate,
    time,
    pickTime,
    showDatePicker,
    setShowDatePicker,
    showTimePicker,
    setShowTimePicker,
    error,
    submit,
    submitting: rescheduleMutation.isPending,
  };
}
