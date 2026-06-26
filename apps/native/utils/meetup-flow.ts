/**
 * Meetup scheduling flow rules — the pure view-model logic behind
 * `MeetupFlowModal` (propose / respond-counter / reschedule). The component owns
 * React state, queries, mutations and JSX; the *rules* for which half-hour slots
 * are bookable, what times to suggest, how a date + time resolve to a concrete
 * instant, and whether that instant may be submitted, live here so they are
 * stated once and testable without rendering the modal.
 *
 * Mirrors the pattern in `onboarding-flow.ts`: pure functions + explicit result
 * types, consumed by the component. These are CLIENT-side conveniences — the
 * server stays the source of truth for matching eligibility, round limits, and
 * real slot availability. The component reads server flags (`canCounterPropose`)
 * and queries (`getAvailableSlots`) directly; this module only does the local
 * date/slot/validation math.
 */
import { addDays, startOfDay } from "date-fns";

import {
  combineLocal,
  formatDayFull,
  formatTime,
  isFuture,
  toDate,
  toIsoDate,
} from "@/lib/dates";

/** All bookable half-hour slots from 08:00 to 20:00 (wall-clock in device tz). */
export const ALL_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const totalMinutes = 8 * 60 + i * 30;
  const h = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const m = String(totalMinutes % 60).padStart(2, "0");
  return `${h}:${m}`;
});

/** A pre-baked "suggested time" card: a device-local day + wall-clock time. */
export type Suggestion = { date: string; time: string; weekday: string; hint?: string };

/**
 * Result of resolving + guarding a chosen date/time. Mirrors the
 * `{ ok: true } | { ok: false; error }` shape used across `onboarding-flow.ts`;
 * on success it also carries the resolved UTC instant, ready for `.toISOString()`.
 */
export type ScheduleValidation =
  | { ok: true; scheduledAt: Date }
  | { ok: false; error: string };

/** Wall-clock "HH:MM" of an instant, in the device timezone. */
export function timeFromDate(d: Date): string {
  return formatTime(d);
}

/**
 * Whether `time` is a well-formed "HH:MM" string (two digits each). This checks
 * SHAPE only, not range — `combineLocal` is what rejects impossible values.
 */
export function isValidTimeFormat(time: string): boolean {
  return /^\d{2}:\d{2}$/.test(time);
}

/** The three default suggested slots: +1/+2/+4 days at 10:30/14:00/15:00. */
export function buildSuggestions(now: Date = new Date()): Suggestion[] {
  const today = startOfDay(now);
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

/**
 * Given a list of blocked UTC instants (Date|string), return the HH:MM slots on
 * `date` (local) that don't collide. Used to render the slot picker. Unparseable
 * blocked entries are ignored.
 */
export function freeSlotsFor(date: string, blocked: Array<Date | string>): string[] {
  const blockedMs = new Set(
    blocked.map((b) => toDate(b)?.getTime()).filter((n): n is number => typeof n === "number"),
  );
  return ALL_SLOTS.filter((slot) => {
    const at = combineLocal(date, slot);
    return at !== null && !blockedMs.has(at.getTime());
  });
}

/**
 * The propose-flow date/time selection — exactly the state the modal's
 * "Plan a sip" screen holds when the user submits.
 */
export type ProposeSelection = {
  customMode: boolean;
  customDateIso: string;
  customTime: string;
  selectedSuggestionIdx: number | null;
  suggestions: Suggestion[];
};

/**
 * Resolve the instant a propose-flow submission would use, or null when the
 * selection is incomplete (custom date/time missing or malformed, or no
 * suggestion picked). Pure extraction of the old inline `pickedScheduledAt`.
 */
export function pickProposedScheduledAt(sel: ProposeSelection): Date | null {
  if (sel.customMode) {
    if (!sel.customDateIso || !isValidTimeFormat(sel.customTime)) return null;
    return combineLocal(sel.customDateIso, sel.customTime);
  }
  if (sel.selectedSuggestionIdx === null) return null;
  const s = sel.suggestions[sel.selectedSuggestionIdx];
  return s ? combineLocal(s.date, s.time) : null;
}

/**
 * Validate a propose-flow submission: the chosen instant must resolve and be in
 * the future. Error copy matches the two paths (custom vs suggested), preserving
 * the messages that were inlined in `handleSubmit`.
 */
export function validateProposedScheduledAt(
  sel: ProposeSelection,
  now: Date = new Date(),
): ScheduleValidation {
  const dt = pickProposedScheduledAt(sel);
  if (!dt) {
    return {
      ok: false,
      error: sel.customMode
        ? "Please pick a date and time (HH:MM)"
        : "Please pick a suggested time",
    };
  }
  if (!isFuture(dt, now)) {
    return { ok: false, error: "The selected date and time must be in the future" };
  }
  return { ok: true, scheduledAt: dt };
}

/**
 * Validate a counter-propose / reschedule submission from a raw date + time. The
 * instant must parse and be in the future. Shared by both flows, whose inline
 * guards were identical.
 */
export function validateScheduledAt(
  date: string,
  time: string,
  now: Date = new Date(),
): ScheduleValidation {
  const proposed = combineLocal(date, time);
  if (!proposed) return { ok: false, error: "Enter a valid date and time" };
  if (!isFuture(proposed, now)) {
    return { ok: false, error: "Date and time must be in the future" };
  }
  return { ok: true, scheduledAt: proposed };
}
