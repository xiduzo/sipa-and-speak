/**
 * Meetup aggregate — pure state machine for the Meetup Scheduling bounded
 * context. Every transition takes a snapshot + actor input, validates the
 * invariants, and returns the next persistent state plus the domain events
 * the caller should emit after persistence succeeds.
 *
 * The aggregate owns no I/O: the router is responsible for loading the
 * snapshot from Drizzle, calling the relevant method, persisting the result,
 * and emitting events.
 *
 * Time is stored and reasoned about as UTC `Date` instants (`scheduledAt`).
 * Wall-clock + timezone display lives at the edges (native / web).
 */

export type MeetupStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "completed"
  | "not_attended";

export type MeetupSnapshot = {
  id: string;
  proposerId: string;
  receiverId: string;
  venueId: string;
  scheduledAt: Date;
  status: MeetupStatus;
  round: number;
  rescheduleProposerId: string | null;
  rescheduleVenueId: string | null;
  rescheduleScheduledAt: Date | null;
};

export type AttendanceReportSnapshot = {
  studentId: string;
  attended: boolean;
};

export type VenueSnapshot = {
  id: string;
  name: string;
  isActive: boolean;
};

export type MeetupEventName =
  | "MeetupProposed"
  | "MeetupConfirmed"
  | "MeetupCounterProposed"
  | "MeetupDeclined"
  | "MeetupCancelled"
  | "MeetupRescheduleProposed"
  | "MeetupRescheduled"
  | "MeetupRescheduleDeclined"
  | "AttendanceReported"
  | "SipAndSpeakMomentCompleted"
  | "MeetupNotAttended";

export type DomainEventToEmit = {
  name: MeetupEventName;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
};

export type RuleErrorCode = "BAD_REQUEST" | "FORBIDDEN" | "CONFLICT" | "NOT_FOUND";

export class MeetupRuleError extends Error {
  constructor(public code: RuleErrorCode, message: string) {
    super(message);
    this.name = "MeetupRuleError";
  }
}

const MAX_ROUND = 5;

function ensureParticipant(s: MeetupSnapshot, actorId: string): void {
  if (s.proposerId !== actorId && s.receiverId !== actorId) {
    throw new MeetupRuleError("FORBIDDEN", "You are not a participant in this meetup");
  }
}

export const Meetup = {
  /**
   * Propose a new meetup. Caller provides preconditions loaded from the DB
   * (suspension state, match record presence, duplicate-pending check, venue).
   */
  propose(args: {
    proposerId: string;
    proposerSuspended: boolean;
    receiverId: string;
    receiverName?: string;
    isMatched: boolean;
    hasDuplicatePending: boolean;
    venue: VenueSnapshot | null;
    scheduledAt: Date;
    now: Date;
  }): { row: Omit<MeetupSnapshot, "id">; events: DomainEventToEmit[] } {
    if (args.proposerId === args.receiverId) {
      throw new MeetupRuleError("BAD_REQUEST", "You cannot propose a meetup with yourself");
    }
    if (args.proposerSuspended) {
      throw new MeetupRuleError(
        "FORBIDDEN",
        "Suspended Students cannot create meetup proposals.",
      );
    }
    if (!args.isMatched) {
      throw new MeetupRuleError(
        "FORBIDDEN",
        "You can only propose meetups with your matched partner",
      );
    }
    if (args.hasDuplicatePending) {
      throw new MeetupRuleError(
        "CONFLICT",
        "A proposal is already awaiting a response from your partner",
      );
    }
    if (!args.venue) {
      throw new MeetupRuleError("NOT_FOUND", "Location not found");
    }
    if (!args.venue.isActive) {
      throw new MeetupRuleError(
        "BAD_REQUEST",
        "This location is no longer available. Please choose another.",
      );
    }
    if (args.scheduledAt <= args.now) {
      throw new MeetupRuleError(
        "BAD_REQUEST",
        "The proposed date and time must be in the future",
      );
    }

    const row = {
      proposerId: args.proposerId,
      receiverId: args.receiverId,
      venueId: args.venue.id,
      scheduledAt: args.scheduledAt,
      status: "pending" as MeetupStatus,
      round: 1,
      rescheduleProposerId: null,
      rescheduleVenueId: null,
      rescheduleScheduledAt: null,
    };

    const events: DomainEventToEmit[] = [
      {
        name: "MeetupProposed",
        payload: {
          proposerId: args.proposerId,
          receiverId: args.receiverId,
          venueName: args.venue.name,
          scheduledAt: args.scheduledAt,
          proposedAt: args.now,
        },
      },
    ];

    return { row, events };
  },

  /** Confirm a pending proposal (receiver-only). */
  confirm(
    state: MeetupSnapshot,
    args: { actorId: string; venueName: string; conflictsCount: number; now: Date },
  ): { state: MeetupSnapshot; events: DomainEventToEmit[] } {
    if (state.receiverId !== args.actorId) {
      throw new MeetupRuleError(
        "FORBIDDEN",
        "Only the current responder can accept this proposal",
      );
    }
    if (state.status !== "pending") {
      throw new MeetupRuleError("CONFLICT", "This proposal has already been responded to");
    }
    if (args.conflictsCount > 0) {
      throw new MeetupRuleError(
        "CONFLICT",
        "Scheduling conflict: one of the participants already has a confirmed meetup at this date and time",
      );
    }

    const next: MeetupSnapshot = { ...state, status: "confirmed" };
    const events: DomainEventToEmit[] = [
      {
        name: "MeetupConfirmed",
        payload: {
          meetupId: state.id,
          proposerId: state.proposerId,
          receiverId: state.receiverId,
          venueName: args.venueName,
          scheduledAt: state.scheduledAt,
          confirmedAt: args.now,
        },
      },
    ];
    return { state: next, events };
  },

  /** Decline a pending proposal (receiver-only). */
  decline(
    state: MeetupSnapshot,
    args: { actorId: string; now: Date },
  ): { state: MeetupSnapshot; events: DomainEventToEmit[] } {
    if (state.receiverId !== args.actorId) {
      throw new MeetupRuleError(
        "FORBIDDEN",
        "Only the current responder can decline this proposal",
      );
    }
    if (state.status !== "pending") {
      throw new MeetupRuleError("CONFLICT", "This proposal has already been responded to");
    }
    const next: MeetupSnapshot = { ...state, status: "declined" };
    const events: DomainEventToEmit[] = [
      {
        name: "MeetupDeclined",
        payload: {
          meetupId: state.id,
          proposerId: state.proposerId,
          receiverId: state.receiverId,
          declinedAt: args.now,
        },
      },
    ];
    return { state: next, events };
  },

  /**
   * Counter-propose: swap roles, increment round, update details. Allowed up
   * to MAX_ROUND (5) — beyond that the responder must accept or decline.
   */
  counterPropose(
    state: MeetupSnapshot,
    args: {
      actorId: string;
      venue: VenueSnapshot | null;
      scheduledAt: Date;
      now: Date;
    },
  ): { state: MeetupSnapshot; events: DomainEventToEmit[] } {
    if (state.receiverId !== args.actorId) {
      throw new MeetupRuleError(
        "FORBIDDEN",
        "Only the current responder can counter-propose",
      );
    }
    if (state.status !== "pending") {
      throw new MeetupRuleError("CONFLICT", "This proposal has already been responded to");
    }
    if (state.round >= MAX_ROUND) {
      throw new MeetupRuleError(
        "BAD_REQUEST",
        "Maximum counter-proposal rounds reached. You can only accept or decline.",
      );
    }
    if (!args.venue) {
      throw new MeetupRuleError("NOT_FOUND", "Location not found");
    }
    if (!args.venue.isActive) {
      throw new MeetupRuleError(
        "BAD_REQUEST",
        "This location is no longer available. Please choose another.",
      );
    }
    if (
      state.venueId === args.venue.id &&
      state.scheduledAt.getTime() === args.scheduledAt.getTime()
    ) {
      throw new MeetupRuleError(
        "BAD_REQUEST",
        "Counter-proposal must differ from the current proposal in at least one detail",
      );
    }
    if (args.scheduledAt <= args.now) {
      throw new MeetupRuleError(
        "BAD_REQUEST",
        "The proposed date and time must be in the future",
      );
    }

    const newProposerId = args.actorId;
    const newReceiverId = state.proposerId;
    const next: MeetupSnapshot = {
      ...state,
      proposerId: newProposerId,
      receiverId: newReceiverId,
      venueId: args.venue.id,
      scheduledAt: args.scheduledAt,
      round: state.round + 1,
    };

    const events: DomainEventToEmit[] = [
      {
        name: "MeetupCounterProposed",
        payload: {
          meetupId: state.id,
          newProposerId,
          newReceiverId,
          venueName: args.venue.name,
          scheduledAt: args.scheduledAt,
          round: next.round,
          counterProposedAt: args.now,
        },
      },
    ];
    return { state: next, events };
  },

  /** Cancel a confirmed meetup (either participant, before the meetup time). */
  cancel(
    state: MeetupSnapshot,
    args: { actorId: string; now: Date },
  ): { state: MeetupSnapshot; events: DomainEventToEmit[] } {
    ensureParticipant(state, args.actorId);
    if (state.status !== "confirmed") {
      throw new MeetupRuleError("BAD_REQUEST", "Only confirmed meetups can be cancelled");
    }
    if (state.scheduledAt <= args.now) {
      throw new MeetupRuleError(
        "BAD_REQUEST",
        "This meetup has already taken place and cannot be cancelled",
      );
    }

    const next: MeetupSnapshot = { ...state, status: "cancelled" };
    const otherStudentId =
      state.proposerId === args.actorId ? state.receiverId : state.proposerId;

    const events: DomainEventToEmit[] = [
      {
        name: "MeetupCancelled",
        payload: {
          meetupId: state.id,
          cancelledById: args.actorId,
          otherStudentId,
          cancelledAt: args.now,
        },
      },
    ];
    return { state: next, events };
  },

  /** Propose a reschedule on a confirmed meetup. One pending at a time. */
  proposeReschedule(
    state: MeetupSnapshot,
    args: {
      actorId: string;
      venue: VenueSnapshot | null;
      scheduledAt: Date;
      now: Date;
    },
  ): { state: MeetupSnapshot; events: DomainEventToEmit[] } {
    ensureParticipant(state, args.actorId);
    if (state.status !== "confirmed") {
      throw new MeetupRuleError(
        "BAD_REQUEST",
        "Only confirmed meetups can be rescheduled",
      );
    }
    if (state.scheduledAt <= args.now) {
      throw new MeetupRuleError(
        "BAD_REQUEST",
        "This meetup has already taken place and cannot be rescheduled",
      );
    }
    if (args.scheduledAt <= args.now) {
      throw new MeetupRuleError(
        "BAD_REQUEST",
        "The rescheduled date and time must be in the future",
      );
    }
    if (!args.venue) {
      throw new MeetupRuleError("NOT_FOUND", "Location not found");
    }
    if (!args.venue.isActive) {
      throw new MeetupRuleError(
        "BAD_REQUEST",
        "This location is no longer available. Please choose another.",
      );
    }
    if (
      state.venueId === args.venue.id &&
      state.scheduledAt.getTime() === args.scheduledAt.getTime()
    ) {
      throw new MeetupRuleError(
        "BAD_REQUEST",
        "The proposed reschedule is identical to the current meetup. Please change at least one detail.",
      );
    }
    if (state.rescheduleProposerId !== null) {
      throw new MeetupRuleError(
        "CONFLICT",
        "A reschedule request is already pending for this meetup. Please wait for your partner to respond.",
      );
    }

    const next: MeetupSnapshot = {
      ...state,
      rescheduleProposerId: args.actorId,
      rescheduleVenueId: args.venue.id,
      rescheduleScheduledAt: args.scheduledAt,
    };
    const receiverId =
      state.proposerId === args.actorId ? state.receiverId : state.proposerId;

    const events: DomainEventToEmit[] = [
      {
        name: "MeetupRescheduleProposed",
        payload: {
          meetupId: state.id,
          proposerId: args.actorId,
          receiverId,
          venueId: args.venue.id,
          venueName: args.venue.name,
          scheduledAt: args.scheduledAt,
          proposedAt: args.now,
        },
      },
    ];
    return { state: next, events };
  },

  /** Accept a pending reschedule (the non-proposing participant only). */
  acceptReschedule(
    state: MeetupSnapshot,
    args: { actorId: string; rescheduleVenueName: string; now: Date },
  ): { state: MeetupSnapshot; events: DomainEventToEmit[] } {
    ensureParticipant(state, args.actorId);
    if (state.status !== "confirmed") {
      throw new MeetupRuleError(
        "BAD_REQUEST",
        "Only confirmed meetups can have a reschedule accepted",
      );
    }
    if (state.rescheduleProposerId === null) {
      throw new MeetupRuleError(
        "BAD_REQUEST",
        "No reschedule proposal is pending for this meetup",
      );
    }
    if (state.rescheduleProposerId === args.actorId) {
      throw new MeetupRuleError(
        "FORBIDDEN",
        "You cannot accept your own reschedule proposal",
      );
    }

    const next: MeetupSnapshot = {
      ...state,
      venueId: state.rescheduleVenueId!,
      scheduledAt: state.rescheduleScheduledAt!,
      rescheduleProposerId: null,
      rescheduleVenueId: null,
      rescheduleScheduledAt: null,
    };

    const events: DomainEventToEmit[] = [
      {
        name: "MeetupRescheduled",
        payload: {
          meetupId: state.id,
          proposerId: state.proposerId,
          receiverId: state.receiverId,
          venueName: args.rescheduleVenueName,
          newScheduledAt: next.scheduledAt,
          rescheduledAt: args.now,
        },
      },
    ];
    return { state: next, events };
  },

  /** Decline a pending reschedule — original meetup details retained. */
  declineReschedule(
    state: MeetupSnapshot,
    args: { actorId: string; venueName: string; now: Date },
  ): { state: MeetupSnapshot; events: DomainEventToEmit[] } {
    ensureParticipant(state, args.actorId);
    if (state.status !== "confirmed") {
      throw new MeetupRuleError(
        "BAD_REQUEST",
        "Only confirmed meetups can have a reschedule declined",
      );
    }
    if (state.rescheduleProposerId === null) {
      throw new MeetupRuleError(
        "BAD_REQUEST",
        "No reschedule proposal is pending for this meetup",
      );
    }
    if (state.rescheduleProposerId === args.actorId) {
      throw new MeetupRuleError(
        "FORBIDDEN",
        "You cannot decline your own reschedule proposal",
      );
    }

    const next: MeetupSnapshot = {
      ...state,
      rescheduleProposerId: null,
      rescheduleVenueId: null,
      rescheduleScheduledAt: null,
    };

    const events: DomainEventToEmit[] = [
      {
        name: "MeetupRescheduleDeclined",
        payload: {
          meetupId: state.id,
          proposerId: state.proposerId,
          receiverId: state.receiverId,
          venueName: args.venueName,
          originalScheduledAt: state.scheduledAt,
          declinedAt: args.now,
        },
      },
    ];
    return { state: next, events };
  },

  /**
   * Report attendance for a confirmed meetup. The aggregate decides:
   *   - whether the report is allowed (status, scheduled time has passed,
   *     no duplicate, rating-without-attendance check),
   *   - whether the meetup transitions to `completed` or `not_attended`
   *     based on the union of existing reports + this new one.
   *
   * The router persists the report row, applies the meetup status update,
   * updates the studentMatch row (cross-context), and emits the events.
   */
  reportAttendance(
    state: MeetupSnapshot,
    args: {
      actorId: string;
      attended: boolean;
      rating: number | null;
      existingReports: AttendanceReportSnapshot[];
      now: Date;
    },
  ): {
    state: MeetupSnapshot;
    report: { studentId: string; attended: boolean; rating: number | null };
    outcome: "pending" | "completed" | "not_attended";
    events: DomainEventToEmit[];
  } {
    ensureParticipant(state, args.actorId);
    if (state.status !== "confirmed") {
      throw new MeetupRuleError(
        "BAD_REQUEST",
        "Only confirmed meetups can receive attendance reports",
      );
    }
    if (state.scheduledAt > args.now) {
      throw new MeetupRuleError(
        "BAD_REQUEST",
        "You can only report attendance after the meetup's scheduled time has passed",
      );
    }
    if (args.existingReports.some((r) => r.studentId === args.actorId)) {
      throw new MeetupRuleError(
        "CONFLICT",
        "You have already reported attendance for this meetup",
      );
    }
    if (args.rating !== null && !args.attended) {
      throw new MeetupRuleError(
        "BAD_REQUEST",
        "Rating can only be provided when attended is true",
      );
    }

    const partnerId =
      state.proposerId === args.actorId ? state.receiverId : state.proposerId;
    const allReports = [
      ...args.existingReports,
      { studentId: args.actorId, attended: args.attended },
    ];

    const events: DomainEventToEmit[] = [
      {
        name: "AttendanceReported",
        payload: {
          meetupId: state.id,
          studentId: args.actorId,
          partnerId,
          attended: args.attended,
          reportedAt: args.now,
        },
      },
    ];

    let outcome: "pending" | "completed" | "not_attended" = "pending";
    let next: MeetupSnapshot = state;

    const bothReported = allReports.length >= 2;
    const anyNoShow = allReports.some((r) => !r.attended);

    if (bothReported && !anyNoShow) {
      outcome = "completed";
      next = { ...state, status: "completed" };
      events.push({
        name: "SipAndSpeakMomentCompleted",
        payload: {
          meetupId: state.id,
          studentAId: state.proposerId,
          studentBId: state.receiverId,
          completedAt: args.now,
        },
      });
    } else if (anyNoShow) {
      outcome = "not_attended";
      next = { ...state, status: "not_attended" };
      events.push({
        name: "MeetupNotAttended",
        payload: {
          meetupId: state.id,
          studentAId: state.proposerId,
          studentBId: state.receiverId,
          recordedAt: args.now,
        },
      });
    }

    return {
      state: next,
      report: { studentId: args.actorId, attended: args.attended, rating: args.rating },
      outcome,
      events,
    };
  },
};
