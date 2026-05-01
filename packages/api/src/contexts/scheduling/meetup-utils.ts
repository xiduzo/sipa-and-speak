/**
 * Pure utility functions for meetup business logic.
 * Kept side-effect-free so they can be unit-tested without a DB.
 */

/**
 * Returns true if the meetup's scheduled date/time has already passed.
 * Uses server clock as the authoritative source.
 */
export function isMeetupInThePast(date: string, time: string): boolean {
  return new Date(`${date}T${time}:00`) <= new Date();
}

/**
 * Returns true if the proposed reschedule details are identical to the
 * currently confirmed meetup — i.e. the Student proposed a no-op.
 */
export function isRescheduleNoOp(
  current: { venueId: string; date: string; time: string },
  proposed: { venueId: string; date: string; time: string },
): boolean {
  return (
    current.venueId === proposed.venueId &&
    current.date === proposed.date &&
    current.time === proposed.time
  );
}

/** Counter-proposals are capped at round 3. */
export function canCounterPropose(round: number): boolean {
  return round < 3;
}

export type AttendanceOutcome = "completed" | "not_attended" | "pending";

/**
 * Derives the S&S Moment outcome from all attendance reports submitted so far.
 * "pending"      — fewer than 2 reports; no conclusion yet.
 * "completed"    — both Students attended; pair transitions to Connected.
 * "not_attended" — at least one Student did not attend; pair returns to Matched.
 */
export function computeAttendanceOutcome(
  reports: { attended: boolean }[],
): AttendanceOutcome {
  if (reports.length < 2) return "pending";
  return reports.every((r) => r.attended) ? "completed" : "not_attended";
}
