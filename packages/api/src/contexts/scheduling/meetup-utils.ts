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
