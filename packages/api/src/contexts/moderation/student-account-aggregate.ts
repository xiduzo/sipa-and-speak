/**
 * StudentAccount aggregate — pure state machine for the Trust & Moderation
 * bounded context. Every transition takes the loaded snapshot(s) + actor input,
 * validates the invariants, and returns the next persistent state plus the
 * domain events the caller should emit after persistence succeeds.
 *
 * The aggregate owns no I/O: the router loads the student (and, for
 * flag-driven transitions, the flag) from Drizzle, calls the relevant method,
 * persists the result inside a unit of work, and emits the returned events —
 * the same shape as the Meetup and MatchRequest aggregates.
 *
 * Lifecycle:
 *
 *   active ──suspend──▶ suspended ──liftSuspension──▶ active
 *   active / suspended ──remove──▶ removed   (terminal; remove is idempotent)
 *
 * Guard semantics are the canonical, most precise variant (previously the five
 * router procedures had drifted):
 *
 *   - removed student            → BAD_REQUEST "Student has been removed."
 *   - already-suspended student  → CONFLICT   "Student is already suspended."
 *   - missing student            → NOT_FOUND  "Student not found."
 *   - missing flag (flag path)   → NOT_FOUND  "Flag not found."
 *   - resolved flag (flag path)  → CONFLICT   "Flag already resolved."
 *   - remove on a removed student → no-op success (no writes, no events).
 */

export type StudentStatus = "active" | "suspended" | "removed";

export type StudentAccountSnapshot = {
  id: string;
  studentStatus: StudentStatus;
};

/** The flag row a flag-driven transition (suspendStudent/removeStudent) resolves. */
export type FlagSnapshot = {
  id: string;
  status: string; // "open" | "resolved"
  targetId: string;
};

export type ModerationEventName =
  | "StudentSuspended"
  | "SuspensionLifted"
  | "StudentRemoved";

export type DomainEventToEmit = {
  name: ModerationEventName;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
};

export type RuleErrorCode = "BAD_REQUEST" | "FORBIDDEN" | "CONFLICT" | "NOT_FOUND";

export class ModerationRuleError extends Error {
  constructor(public code: RuleErrorCode, message: string) {
    super(message);
    this.name = "ModerationRuleError";
  }
}

/** Intent to resolve the driving flag in the same unit of work. */
export type ResolveFlag = {
  flagId: string;
  outcome: "suspended" | "removed";
};

/**
 * Flag-path guard shared by suspend/remove: the flag must exist and still be
 * open. `flag === undefined` means the transition is a direct admin action
 * (no flag involved); `flag === null` means the caller looked one up and it
 * was missing.
 */
function ensureOpenFlag(flag: FlagSnapshot | null | undefined): void {
  if (flag === undefined) return;
  if (!flag) {
    throw new ModerationRuleError("NOT_FOUND", "Flag not found.");
  }
  if (flag.status !== "open") {
    throw new ModerationRuleError("CONFLICT", "Flag already resolved.");
  }
}

function ensureStudentExists(
  student: StudentAccountSnapshot | null,
): asserts student is StudentAccountSnapshot {
  if (!student) {
    throw new ModerationRuleError("NOT_FOUND", "Student not found.");
  }
}

export const StudentAccount = {
  /**
   * Suspend a Student (active → suspended). Pass `flag` (the loaded row or
   * null) when the suspension resolves a report; omit it for a direct admin
   * suspension from the Users list.
   */
  suspend(args: {
    student: StudentAccountSnapshot | null;
    flag?: FlagSnapshot | null;
    moderatorId: string;
    now: Date;
  }): { status: StudentStatus; resolveFlag: ResolveFlag | null; events: DomainEventToEmit[] } {
    ensureOpenFlag(args.flag);
    ensureStudentExists(args.student);
    if (args.student.studentStatus === "removed") {
      throw new ModerationRuleError("BAD_REQUEST", "Student has been removed.");
    }
    if (args.student.studentStatus === "suspended") {
      throw new ModerationRuleError("CONFLICT", "Student is already suspended.");
    }

    const resolveFlag: ResolveFlag | null = args.flag
      ? { flagId: args.flag.id, outcome: "suspended" }
      : null;

    const events: DomainEventToEmit[] = [
      {
        name: "StudentSuspended",
        payload: {
          flagId: args.flag?.id ?? null,
          targetId: args.student.id,
          moderatorId: args.moderatorId,
          suspendedAt: args.now,
        },
      },
    ];

    return { status: "suspended", resolveFlag, events };
  },

  /** Lift a suspension (suspended → active). */
  liftSuspension(args: {
    student: StudentAccountSnapshot | null;
    moderatorId: string;
    now: Date;
  }): { status: StudentStatus; events: DomainEventToEmit[] } {
    ensureStudentExists(args.student);
    if (args.student.studentStatus !== "suspended") {
      throw new ModerationRuleError("BAD_REQUEST", "Student is not suspended.");
    }

    const events: DomainEventToEmit[] = [
      {
        name: "SuspensionLifted",
        payload: {
          targetId: args.student.id,
          moderatorId: args.moderatorId,
          liftedAt: args.now,
        },
      },
    ];

    return { status: "active", events };
  },

  /**
   * Permanently remove a Student (active/suspended → removed). Idempotent: a
   * second removal returns `noop: true` — no writes, no flag resolution, no
   * events. The flag guards still run first, so acting through an
   * already-resolved flag is a CONFLICT even for a removed student.
   */
  remove(args: {
    student: StudentAccountSnapshot | null;
    flag?: FlagSnapshot | null;
    moderatorId: string;
    now: Date;
  }):
    | { noop: true; status: StudentStatus; resolveFlag: null; events: DomainEventToEmit[] }
    | { noop: false; status: StudentStatus; resolveFlag: ResolveFlag | null; events: DomainEventToEmit[] } {
    ensureOpenFlag(args.flag);
    ensureStudentExists(args.student);
    if (args.student.studentStatus === "removed") {
      return { noop: true, status: "removed", resolveFlag: null, events: [] };
    }

    const resolveFlag: ResolveFlag | null = args.flag
      ? { flagId: args.flag.id, outcome: "removed" }
      : null;

    const events: DomainEventToEmit[] = [
      {
        name: "StudentRemoved",
        payload: {
          flagId: args.flag?.id ?? null,
          targetId: args.student.id,
          moderatorId: args.moderatorId,
          removedAt: args.now,
        },
      },
    ];

    return { noop: false, status: "removed", resolveFlag, events };
  },
};
