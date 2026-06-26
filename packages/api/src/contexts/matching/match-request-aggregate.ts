/**
 * MatchRequest aggregate — pure state machine for the Matching bounded context.
 * Every transition takes a snapshot + actor input, validates the invariants,
 * and returns the next persistent state plus the domain events the caller
 * should emit after persistence succeeds.
 *
 * The aggregate owns no I/O: the router loads the snapshot from Drizzle, calls
 * the relevant method, persists the result inside a unit of work, and emits the
 * returned events. Before this aggregate existed the transition guards were
 * inlined across five mutations in `matching.ts`; the lifecycle now lives in one
 * place, the way the Meetup aggregate owns the meetup lifecycle.
 *
 * Lifecycle:
 *
 *   (none) ──send──▶ pending ──accept──▶ accepted  (+ creates a StudentMatch)
 *                       │   ╲decline────▶ declined
 *                       │    ╲withdraw──▶ (row hard-deleted)
 *                    accepted ──unmatch─▶ voided    (+ drops the StudentMatch)
 */

export type MatchRequestStatus = "pending" | "accepted" | "declined" | "voided";

export type MatchRequestSnapshot = {
  id: string;
  requesterId: string;
  receiverId: string;
  status: MatchRequestStatus;
};

/** The row shape persisted by `send` (id assigned by the DB). */
export type NewMatchRequestRow = {
  requesterId: string;
  receiverId: string;
  status: MatchRequestStatus;
};

/** Intent to create a StudentMatch when a request is accepted. */
export type CreateMatch = {
  studentAId: string;
  studentBId: string;
};

export type MatchRequestEventName =
  | "MatchRequestSent"
  | "MatchRequestAccepted"
  | "MatchRequestDeclined";

export type DomainEventToEmit = {
  name: MatchRequestEventName;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
};

export type RuleErrorCode = "BAD_REQUEST" | "FORBIDDEN" | "CONFLICT" | "NOT_FOUND";

export class MatchRuleError extends Error {
  constructor(public code: RuleErrorCode, message: string) {
    super(message);
    this.name = "MatchRuleError";
  }
}

/** Receiver-only transitions (accept / decline) share this guard. */
function assertReceiver(state: MatchRequestSnapshot, actorId: string, verb: string): void {
  if (state.receiverId !== actorId) {
    throw new MatchRuleError(
      "FORBIDDEN",
      `Only the designated receiver may ${verb} this request.`,
    );
  }
}

/** A request must be pending to be accepted / declined. */
function assertPending(state: MatchRequestSnapshot, pastTense: string): void {
  if (state.status !== "pending") {
    throw new MatchRuleError("BAD_REQUEST", `Only pending requests can be ${pastTense}.`);
  }
}

export const MatchRequest = {
  /**
   * Send a new request. Caller provides preconditions loaded from the DB
   * (whether the receiver profile still exists, and whether an active request
   * to the same receiver already exists). The emitted `MatchRequestSent` event
   * lacks `matchRequestId` — the router fills it in once the insert returns.
   */
  send(args: {
    requesterId: string;
    requesterName: string;
    receiverId: string;
    receiverExists: boolean;
    offeredLanguage: string | null;
    targetedLanguage: string | null;
    hasActiveRequest: boolean;
    now: Date;
  }): { row: NewMatchRequestRow; events: DomainEventToEmit[] } {
    if (args.requesterId === args.receiverId) {
      throw new MatchRuleError("BAD_REQUEST", "You cannot send a match request to yourself.");
    }
    if (!args.receiverExists) {
      throw new MatchRuleError("NOT_FOUND", "This profile is no longer available.");
    }
    if (args.hasActiveRequest) {
      throw new MatchRuleError("CONFLICT", "A match request to this candidate already exists.");
    }

    const row: NewMatchRequestRow = {
      requesterId: args.requesterId,
      receiverId: args.receiverId,
      status: "pending",
    };

    const events: DomainEventToEmit[] = [
      {
        name: "MatchRequestSent",
        payload: {
          requesterId: args.requesterId,
          requesterName: args.requesterName,
          offeredLanguage: args.offeredLanguage,
          targetedLanguage: args.targetedLanguage,
          receiverId: args.receiverId,
          sentAt: args.now,
        },
      },
    ];

    return { row, events };
  },

  /**
   * Accept a pending request (receiver-only). Returns the next state plus the
   * StudentMatch to create — both writes must land in the same unit of work,
   * else an accepted request could be left with no match (or vice versa).
   */
  accept(
    state: MatchRequestSnapshot,
    args: { actorId: string; receiverName: string; now: Date },
  ): { state: MatchRequestSnapshot; createMatch: CreateMatch; events: DomainEventToEmit[] } {
    assertReceiver(state, args.actorId, "accept");
    assertPending(state, "accepted");

    const next: MatchRequestSnapshot = { ...state, status: "accepted" };
    const createMatch: CreateMatch = {
      studentAId: state.requesterId,
      studentBId: args.actorId,
    };
    const events: DomainEventToEmit[] = [
      {
        name: "MatchRequestAccepted",
        payload: {
          matchRequestId: state.id,
          requesterId: state.requesterId,
          receiverId: args.actorId,
          receiverName: args.receiverName,
          acceptedAt: args.now,
        },
      },
    ];

    return { state: next, createMatch, events };
  },

  /** Decline a pending request (receiver-only). Declined requests may be re-sent. */
  decline(
    state: MatchRequestSnapshot,
    args: { actorId: string; now: Date },
  ): { state: MatchRequestSnapshot; events: DomainEventToEmit[] } {
    assertReceiver(state, args.actorId, "decline");
    assertPending(state, "declined");

    const next: MatchRequestSnapshot = { ...state, status: "declined" };
    const events: DomainEventToEmit[] = [
      {
        name: "MatchRequestDeclined",
        payload: {
          matchRequestId: state.id,
          requesterId: state.requesterId,
          receiverId: args.actorId,
          declinedAt: args.now,
        },
      },
    ];

    return { state: next, events };
  },

  /**
   * Withdraw a still-pending request (sender-only). The row is hard-deleted so
   * the invite fully reverses; no event is emitted (the receiver was never
   * notified of a "cancelled" request). Returns `delete: true` to signal the
   * router to remove the row.
   */
  withdraw(
    state: MatchRequestSnapshot,
    args: { actorId: string },
  ): { delete: true; events: DomainEventToEmit[] } {
    if (state.requesterId !== args.actorId) {
      throw new MatchRuleError("FORBIDDEN", "Only the sender may withdraw this invitation.");
    }
    if (state.status !== "pending") {
      throw new MatchRuleError("BAD_REQUEST", "Only pending invitations can be withdrawn.");
    }
    return { delete: true, events: [] };
  },

  /**
   * Unmatch an existing buddy. Voids the underlying request (keeps the pair out
   * of discover) and signals the router to drop the StudentMatch — both writes
   * belong in one unit of work. `matchExists` is the loaded precondition.
   */
  unmatch(args: {
    actorId: string;
    partnerId: string;
    matchExists: boolean;
  }): { voidRequest: true; events: DomainEventToEmit[] } {
    if (args.actorId === args.partnerId) {
      throw new MatchRuleError("BAD_REQUEST", "You cannot unmatch yourself.");
    }
    if (!args.matchExists) {
      throw new MatchRuleError("NOT_FOUND", "You are not matched with this person.");
    }
    return { voidRequest: true, events: [] };
  },
};
