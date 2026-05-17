import { format, formatDistanceToNow, differenceInCalendarDays } from "date-fns";

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

/** "Sat 14:00" in the viewer's device timezone. */
export function formatDayTime(input: Date | string): string {
  return format(toDate(input), "EEE HH:mm");
}

/** "Saturday" in the viewer's device timezone. */
export function formatDayFull(input: Date | string): string {
  return format(toDate(input), "EEEE");
}

/** "14:00" in the viewer's device timezone. */
export function formatTime(input: Date | string): string {
  return format(toDate(input), "HH:mm");
}

/** "5 minutes ago", "2 days ago". */
export function formatRelativeTime(input: string | Date, now: Date = new Date()): string {
  const d = toDate(input);
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60_000) return "Just now";
  return `${formatDistanceToNow(d, { addSuffix: false })} ago`;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.abs(differenceInCalendarDays(a, b));
}
