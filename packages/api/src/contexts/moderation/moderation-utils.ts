/**
 * Pure helpers for the moderation context — only deep helpers worth extracting live here.
 * Shallow predicates and event-payload literals have been inlined at their callsites.
 */

// #67 — Validation message map for flag-submission errors

export const FLAG_VALIDATION_MESSAGES: Record<"SELF_FLAG" | "DUPLICATE_OPEN_FLAG", string> = {
  SELF_FLAG: "You cannot flag yourself.",
  DUPLICATE_OPEN_FLAG: "A report against this Student is already under review.",
};

// #92 — Guard message: Student must be active before warn/suspend
export const STUDENT_INACTIVE_MESSAGE =
  "Action no longer available — Student is suspended or removed";

// #109 — Email blocklist normalisation

/**
 * Normalises an email address to lowercase + trimmed for blocklist storage and comparison.
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

// #78 — Moderator flag-queue projection

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

// #80 — Moderator flag-detail projection

export interface FlagDetailRow {
  id: string;
  targetId: string;
  targetName: string | null;
  targetStatus: string | null; // #100 — studentStatus from user table
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
  flaggedStudent: { id: string; name: string | null; removed: boolean; suspended: boolean };
  reason: string;
  detail: string | null;
  submittedAt: string;
  priorFlags: Array<{ reason: string; outcome: string | null; resolvedAt: string }>;
}

/**
 * Builds the flag detail API response from DB rows.
 * `removed` is true when studentStatus is 'removed' OR targetName is null (legacy proxy).
 * `suspended` is true when studentStatus is 'suspended'.
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
      removed: flag.targetStatus === "removed" || flag.targetName === null,
      suspended: flag.targetStatus === "suspended",
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
