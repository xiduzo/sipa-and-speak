import {
  addDays,
  differenceInCalendarDays,
  formatDistanceToNow,
  isAfter,
  isSameDay,
  isValid,
  isYesterday,
  parse,
  parseISO,
  startOfDay,
} from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export type DateInput = Date | string | number | null | undefined;

let cachedTz: string | null = null;

/** Device timezone (IANA), resolved lazily so import never throws on a host
 *  with partial Intl support. Falls back to "UTC". */
export function deviceTimeZone(): string {
  if (cachedTz) return cachedTz;
  try {
    cachedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    cachedTz = "UTC";
  }
  return cachedTz;
}

/** Coerce any input to a Date, returning null when invalid. ISO strings are
 *  parsed via `parseISO` (matches what the server emits). */
export function toDate(input: DateInput): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return isValid(input) ? input : null;
  if (typeof input === "number") {
    const d = new Date(input);
    return isValid(d) ? d : null;
  }
  const d = parseISO(input);
  return isValid(d) ? d : null;
}

/** Format an instant in the device's timezone. Returns `fallback` on invalid. */
export function safeFormat(input: DateInput, pattern: string, fallback = ""): string {
  const d = toDate(input);
  return d ? formatInTimeZone(d, deviceTimeZone(), pattern) : fallback;
}

/** "Sat 14:00" in the device timezone. */
export function formatDayTime(input: DateInput): string {
  return safeFormat(input, "EEE HH:mm");
}

/** "Saturday" in the device timezone. */
export function formatDayFull(input: DateInput): string {
  return safeFormat(input, "EEEE");
}

/** "14:00" in the device timezone. */
export function formatTime(input: DateInput): string {
  return safeFormat(input, "HH:mm");
}

/** "May 17, 2026" style — long date in the device timezone. */
export function formatLongDate(input: DateInput): string {
  return safeFormat(input, "MMMM d, yyyy");
}

/** "Sat, May 17, 2026" — long date with weekday in the device timezone. */
export function formatLongDayDate(input: DateInput): string {
  return safeFormat(input, "EEE, MMMM d, yyyy");
}

/** "5 minutes ago" / "2 days ago" / "Just now". */
export function formatRelativeTime(input: DateInput, now: Date = new Date()): string {
  const d = toDate(input);
  if (!d) return "";
  if (now.getTime() - d.getTime() < 60_000) return "Just now";
  return `${formatDistanceToNow(d, { addSuffix: false })} ago`;
}

/** Conversation-row timestamp: "just now" / "HH:mm" / "Yesterday" / "EEE" / "MMM d". */
export function formatChatTimestamp(input: DateInput, now: Date = new Date()): string {
  const at = toDate(input);
  if (!at) return "";
  if (now.getTime() - at.getTime() < 60_000) return "just now";
  if (isSameDay(at, now)) return safeFormat(at, "HH:mm");
  if (isYesterday(at)) return "Yesterday";
  if (differenceInCalendarDays(now, at) < 7) return safeFormat(at, "EEE");
  return safeFormat(at, "MMM d");
}

/** Section header inside a chat: "TODAY" / "YESTERDAY" / "FRIDAY" / "MAY 17". */
export function formatChatSectionLabel(input: DateInput, now: Date = new Date()): string {
  const d = toDate(input);
  if (!d) return "";
  const diff = differenceInCalendarDays(now, d);
  if (diff === 0) return "TODAY";
  if (diff === 1) return "YESTERDAY";
  if (diff < 7) return safeFormat(d, "EEEE").toUpperCase();
  return safeFormat(d, "MMM d").toUpperCase();
}

/** Lock-expiry phrase: "today HH:mm" / "tomorrow HH:mm" / "EEEE HH:mm" / "MMM d". */
export function formatUnlockMoment(input: DateInput, now: Date = new Date()): string {
  const at = toDate(input);
  if (!at) return "";
  const days = differenceInCalendarDays(at, now);
  const time = safeFormat(at, "HH:mm");
  if (days <= 0) return `today ${time}`;
  if (days === 1) return `tomorrow ${time}`;
  if (days < 7) return `${safeFormat(at, "EEEE")} ${time}`;
  return safeFormat(at, "MMM d");
}

/** Absolute calendar-day distance between two dates. Returns 0 on invalid input. */
export function daysBetween(a: DateInput, b: DateInput): number {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return 0;
  return Math.abs(differenceInCalendarDays(da, db));
}

/** Start-of-day epoch ms in the device timezone. Returns NaN on invalid. */
export function startOfDayMs(input: DateInput): number {
  const d = toDate(input);
  if (!d) return Number.NaN;
  return fromZonedTime(startOfDay(d), deviceTimeZone()).getTime();
}

/** Epoch ms or NaN — handy for sort comparators (NaN sorts as 0, stable). */
export function epochMs(input: DateInput): number {
  const d = toDate(input);
  return d ? d.getTime() : Number.NaN;
}

/** YYYY-MM-DD in the device timezone. */
export function toIsoDate(d: Date): string {
  return formatInTimeZone(d, deviceTimeZone(), "yyyy-MM-dd");
}

/** Combine a YYYY-MM-DD + HH:MM wall-clock in the device tz into a UTC Date.
 *  Returns null when either component is malformed or the result is invalid. */
export function combineLocal(date: string, time: string): Date | null {
  const wall = parse(`${date} ${time}`, "yyyy-MM-dd HH:mm", new Date());
  if (!isValid(wall)) return null;
  const utc = fromZonedTime(wall, deviceTimeZone());
  return isValid(utc) ? utc : null;
}

/** UTC bounds [start, end) covering one device-local day. */
export function dayBoundsIso(date: string): { startIso: string; endIso: string } | null {
  const start = combineLocal(date, "00:00");
  if (!start) return null;
  const end = addDays(start, 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/** True when `input` resolves to a future instant relative to `now`. */
export function isFuture(input: DateInput, now: Date = new Date()): boolean {
  const d = toDate(input);
  return d ? isAfter(d, now) : false;
}
