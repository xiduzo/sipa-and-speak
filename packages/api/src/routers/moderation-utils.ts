// #67 — Pure validation functions for flag submission

export type FlagValidationError =
  | { valid: false; error: "SELF_FLAG" }
  | { valid: false; error: "DUPLICATE_OPEN_FLAG" }
  | { valid: true };

/**
 * Rejects a flag where the reporter and target are the same user.
 */
export function checkSelfFlag(
  reporterId: string,
  targetId: string,
): FlagValidationError {
  if (reporterId === targetId) {
    return { valid: false, error: "SELF_FLAG" };
  }
  return { valid: true };
}

/**
 * Rejects a flag when an open flag already exists for the same
 * reporter–target pair. The caller supplies the open-flag count from the DB.
 */
export function checkDuplicateOpenFlag(
  openFlagCount: number,
): FlagValidationError {
  if (openFlagCount > 0) {
    return { valid: false, error: "DUPLICATE_OPEN_FLAG" };
  }
  return { valid: true };
}

export const FLAG_VALIDATION_MESSAGES: Record<"SELF_FLAG" | "DUPLICATE_OPEN_FLAG", string> = {
  SELF_FLAG: "You cannot flag yourself.",
  DUPLICATE_OPEN_FLAG: "A report against this Student is already under review.",
};

// #72 — Pure helpers for flag persistence

export interface FlagValues {
  reporterId: string;
  targetId: string;
  reason: string;
  detail: string | undefined;
  status: "open";
}

/**
 * Builds the DB insert payload for a new flag.
 * Status is always 'open' on creation.
 */
export function buildFlagValues(input: {
  reporterId: string;
  targetId: string;
  reason: string;
  detail?: string;
}): FlagValues {
  return {
    reporterId: input.reporterId,
    targetId: input.targetId,
    reason: input.reason,
    detail: input.detail,
    status: "open",
  };
}

export interface StudentFlaggedPayload {
  flagId: string;
  reporterId: string;
  targetId: string;
  reason: string;
  flaggedAt: Date;
}

/**
 * Builds the StudentFlagged domain event payload from the persisted flag row.
 */
// #78 — Pure helpers for the Moderator flag queue

export interface FlagQueueRow {
  id: string;
  targetId: string;
  targetName: string | null;
  reason: string;
  createdAt: Date;
}

export interface FlagQueueEntry {
  flagId: string;
  flaggedStudent: { id: string; name: string | null };
  reason: string;
  submittedAt: string;
}

/**
 * Maps a DB row (userFlag joined with user) to the API queue entry shape.
 */
export function buildFlagQueueEntry(row: FlagQueueRow): FlagQueueEntry {
  return {
    flagId: row.id,
    flaggedStudent: { id: row.targetId, name: row.targetName },
    reason: row.reason,
    submittedAt: row.createdAt.toISOString(),
  };
}

/**
 * Sorts an array of flag rows oldest-first (ascending createdAt).
 * Returns a new array — does not mutate the original.
 */
export function sortFlagsOldestFirst<T extends { createdAt: Date }>(flags: T[]): T[] {
  return [...flags].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * Returns true only when status is exactly 'open'.
 * Drives the WHERE status='open' filter at the DB layer.
 */
export function isOpenFlag(status: string): boolean {
  return status === "open";
}

// #80 — Pure helpers for the Moderator flag detail view

export interface FlagDetailRow {
  id: string;
  targetId: string;
  targetName: string | null;
  reason: string;
  detail: string | null;
  createdAt: Date;
}

export interface PriorFlagRow {
  reason: string;
  outcome: string | null;
  createdAt: Date;
  resolvedAt?: Date | null; // #90 — actual resolution timestamp; falls back to createdAt for legacy rows
}

export interface FlagDetailEntry {
  flagId: string;
  // #88 — `suspended` added; always false until Feature #33 adds the DB column
  flaggedStudent: { id: string; name: string | null; removed: boolean; suspended: boolean };
  reason: string;
  detail: string | null;
  submittedAt: string;
  priorFlags: Array<{ reason: string; outcome: string | null; resolvedAt: string }>;
}

/**
 * Builds the flag detail API response from DB rows.
 * `removed` is true when the flagged Student's user record is absent (null name + no match).
 * `suspended` is always false until Feature #33 adds a DB-level suspended status.
 */
export function buildFlagDetail(
  flag: FlagDetailRow,
  priorFlags: PriorFlagRow[],
): FlagDetailEntry {
  return {
    flagId: flag.id,
    flaggedStudent: {
      id: flag.targetId,
      name: flag.targetName,
      removed: flag.targetName === null,
      suspended: false, // Feature #33 will set this from the DB
    },
    reason: flag.reason,
    detail: flag.detail,
    submittedAt: flag.createdAt.toISOString(),
    priorFlags: priorFlags.map((p) => ({
      reason: p.reason,
      outcome: p.outcome,
      resolvedAt: (p.resolvedAt ?? p.createdAt).toISOString(),
    })),
  };
}

export function buildStudentFlaggedEvent(
  flagId: string,
  input: { reporterId: string; targetId: string; reason: string },
  flaggedAt: Date,
): StudentFlaggedPayload {
  return {
    flagId,
    reporterId: input.reporterId,
    targetId: input.targetId,
    reason: input.reason,
    flaggedAt,
  };
}

// #90 — Pure helpers for the warn resolution flow

export interface WarnFlagValues {
  status: "resolved";
  outcome: "warned";
  moderatorId: string;
  resolvedAt: Date;
}

/**
 * Builds the DB update payload for resolving a flag with outcome 'warned'.
 */
export function buildWarnFlagValues(moderatorId: string, resolvedAt: Date): WarnFlagValues {
  return {
    status: "resolved",
    outcome: "warned",
    moderatorId,
    resolvedAt,
  };
}

export interface StudentWarnedPayload {
  flagId: string;
  targetId: string;
  moderatorId: string;
  warnedAt: Date;
}

/**
 * Builds the StudentWarned domain event payload from the resolved flag.
 */
export function buildStudentWarnedEvent(
  flagId: string,
  targetId: string,
  moderatorId: string,
  warnedAt: Date,
): StudentWarnedPayload {
  return { flagId, targetId, moderatorId, warnedAt };
}

/**
 * Returns true if the given flag status allows a warn action (must be 'open').
 */
export function canWarnFlag(status: string): boolean {
  return status === "open";
}
