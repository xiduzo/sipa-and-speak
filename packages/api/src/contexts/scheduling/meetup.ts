import { and, eq, or, sql, count, gte, lt, inArray } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@sip-and-speak/db";
import { meetup, venue, attendanceReport } from "@sip-and-speak/db/schema/scheduling";
import { studentMatch } from "@sip-and-speak/db/schema/matching";
import { user } from "@sip-and-speak/db/schema/auth";
import { protectedProcedure, router } from "../../index";
import { commitAndEmit, type BufferedEvent } from "../../unit-of-work";
import {
  Meetup,
  MeetupRuleError,
  type DomainEventToEmit,
  type MeetupSnapshot,
  type VenueSnapshot,
} from "./meetup-aggregate";
import {
  listMeetupsForUser,
  getConfirmedMeetupsForUser,
} from "./meetup-read-model";

/**
 * Format a UTC Date as wall-clock parts in the given IANA timezone.
 * Used to enrich domain events with display-friendly date/time strings for
 * push notification builders. Uses Intl (no external dep).
 */
function wallClockIn(date: Date, tz: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
  };
}

/** Canonical zone for push notification body strings. */
const NOTIFICATION_ZONE = "Europe/Amsterdam";

/** Convert aggregate rule violations into the right tRPC error code. */
function toTrpcError(err: unknown): never {
  if (err instanceof MeetupRuleError) {
    throw new TRPCError({ code: err.code, message: err.message });
  }
  throw err;
}

// #446 — Shown to the partner when they try to act on a meetup whose
// counterparty has soft-deleted their account mid-process.
export const PARTNER_DELETED_MESSAGE =
  "Sorry, this user has deleted their account in the middle of the process";

/**
 * Guard a meetup action against a counterparty who no longer exists or has
 * deleted their account. Throws the canonical partner-deleted error so the
 * client can surface the dialog and block further reschedule/propose/counter.
 */
async function assertPartnerActive(partnerId: string): Promise<void> {
  const [row] = await db
    .select({ deletedAt: user.deletedAt })
    .from(user)
    .where(eq(user.id, partnerId))
    .limit(1);
  if (!row || row.deletedAt !== null) {
    throw new TRPCError({ code: "CONFLICT", message: PARTNER_DELETED_MESSAGE });
  }
}

/**
 * For events that carry `scheduledAt` (Date), enrich the payload with
 * `date`/`time` strings formatted in the canonical zone so notification
 * builders can keep using string interpolation without timezone work.
 */
function enrichPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...payload };
  if (out.scheduledAt instanceof Date) {
    const wc = wallClockIn(out.scheduledAt, NOTIFICATION_ZONE);
    out.date = wc.date;
    out.time = wc.time;
  }
  if (out.newScheduledAt instanceof Date) {
    const wc = wallClockIn(out.newScheduledAt, NOTIFICATION_ZONE);
    out.newDate = wc.date;
    out.newTime = wc.time;
  }
  if (out.originalScheduledAt instanceof Date) {
    const wc = wallClockIn(out.originalScheduledAt, NOTIFICATION_ZONE);
    out.originalDate = wc.date;
    out.originalTime = wc.time;
  }
  return out;
}

/**
 * Map aggregate events to buffered events, applying payload enrichment. The
 * buffer is handed to `commitAndEmit`, which fires them only after the
 * transaction commits — so a rolled-back transition emits nothing.
 */
function toBuffered(
  events: DomainEventToEmit[],
  extraPayload: Record<string, unknown> = {},
): BufferedEvent[] {
  return events.map((e) => ({
    name: e.name,
    payload: enrichPayload({ ...e.payload, ...extraPayload }),
  }));
}

/** Load the venue snapshot the aggregate needs for proposal-style transitions. */
async function loadVenueSnapshot(venueId: string): Promise<VenueSnapshot | null> {
  const [row] = await db
    .select({ id: venue.id, name: venue.name, isActive: venue.isActive })
    .from(venue)
    .where(eq(venue.id, venueId))
    .limit(1);
  return row ?? null;
}

async function loadMeetupSnapshot(meetupId: string): Promise<MeetupSnapshot | null> {
  const [row] = await db.select().from(meetup).where(eq(meetup.id, meetupId)).limit(1);
  return row ?? null;
}

const scheduledAtInput = z
  .union([z.iso.datetime(), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)));

export const meetupRouter = router({
  canPropose: protectedProcedure
    .input(z.object({ partnerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const [match, pending] = await Promise.all([
        db
          .select({ id: studentMatch.id })
          .from(studentMatch)
          .where(
            or(
              and(eq(studentMatch.studentAId, userId), eq(studentMatch.studentBId, input.partnerId)),
              and(eq(studentMatch.studentAId, input.partnerId), eq(studentMatch.studentBId, userId)),
            ),
          )
          .limit(1),
        db
          .select({ id: meetup.id })
          .from(meetup)
          .where(
            and(
              eq(meetup.status, "pending"),
              or(
                and(eq(meetup.proposerId, userId), eq(meetup.receiverId, input.partnerId)),
                and(eq(meetup.proposerId, input.partnerId), eq(meetup.receiverId, userId)),
              ),
            ),
          )
          .limit(1),
      ]);
      return { isMatched: match.length > 0, hasPendingProposal: pending.length > 0 };
    }),

  propose: protectedProcedure
    .input(
      z.object({
        partnerId: z.string(),
        venueId: z.string(),
        scheduledAt: scheduledAtInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // #446 — refuse to propose to a partner who has deleted their account.
      await assertPartnerActive(input.partnerId);

      const [[proposer], matchRows, pendingRows, venueRow] = await Promise.all([
        db.select({ studentStatus: user.studentStatus }).from(user).where(eq(user.id, userId)).limit(1),
        db
          .select({ id: studentMatch.id })
          .from(studentMatch)
          .where(
            or(
              and(eq(studentMatch.studentAId, userId), eq(studentMatch.studentBId, input.partnerId)),
              and(eq(studentMatch.studentAId, input.partnerId), eq(studentMatch.studentBId, userId)),
            ),
          )
          .limit(1),
        db
          .select({ id: meetup.id })
          .from(meetup)
          .where(
            and(
              eq(meetup.status, "pending"),
              or(
                and(eq(meetup.proposerId, userId), eq(meetup.receiverId, input.partnerId)),
                and(eq(meetup.proposerId, input.partnerId), eq(meetup.receiverId, userId)),
              ),
            ),
          )
          .limit(1),
        loadVenueSnapshot(input.venueId),
      ]);

      let decision;
      try {
        decision = Meetup.propose({
          proposerId: userId,
          proposerSuspended: proposer?.studentStatus === "suspended",
          receiverId: input.partnerId,
          isMatched: matchRows.length > 0,
          hasDuplicatePending: pendingRows.length > 0,
          venue: venueRow,
          scheduledAt: input.scheduledAt,
          now: new Date(),
        });
      } catch (err) {
        toTrpcError(err);
      }

      return commitAndEmit(async (tx) => {
        const [created] = await tx.insert(meetup).values(decision.row).returning();
        return {
          result: created,
          events: toBuffered(decision.events, { meetupId: created!.id }),
        };
      });
    }),

  /**
   * Combined accept/decline endpoint. Dispatches to the same aggregate
   * transitions as `acceptProposal` / `declineProposal`.
   */
  respond: protectedProcedure
    .input(
      z.object({
        meetupId: z.string(),
        action: z.enum(["accept", "decline"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const existing = await loadMeetupSnapshot(input.meetupId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meetup not found" });
      }

      if (input.action === "accept") {
        const [venueRow] = await db
          .select({ name: venue.name })
          .from(venue)
          .where(eq(venue.id, existing.venueId))
          .limit(1);
        const conflicts = await db
          .select({ id: meetup.id })
          .from(meetup)
          .where(
            and(
              eq(meetup.scheduledAt, existing.scheduledAt),
              eq(meetup.status, "confirmed"),
              or(
                eq(meetup.proposerId, userId),
                eq(meetup.receiverId, userId),
                eq(meetup.proposerId, existing.proposerId),
                eq(meetup.receiverId, existing.proposerId),
              ),
            ),
          );

        let decision;
        try {
          decision = Meetup.confirm(existing, {
            actorId: userId,
            venueName: venueRow?.name ?? "",
            conflictsCount: conflicts.length,
            now: new Date(),
          });
        } catch (err) {
          toTrpcError(err);
        }
        return commitAndEmit(async (tx) => {
          const [updated] = await tx
            .update(meetup)
            .set({ status: decision.state.status })
            .where(eq(meetup.id, existing.id))
            .returning();
          return { result: updated, events: toBuffered(decision.events) };
        });
      }

      // decline path
      let decision;
      try {
        decision = Meetup.decline(existing, { actorId: userId, now: new Date() });
      } catch (err) {
        toTrpcError(err);
      }
      return commitAndEmit(async (tx) => {
        const [updated] = await tx
          .update(meetup)
          .set({ status: decision.state.status })
          .where(eq(meetup.id, existing.id))
          .returning();
        return { result: updated, events: toBuffered(decision.events) };
      });
    }),

  // #75 — Accept a pending proposal → confirm meetup, emit MeetupConfirmed
  acceptProposal: protectedProcedure
    .input(z.object({ meetupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const existing = await loadMeetupSnapshot(input.meetupId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meetup not found" });
      }
      const [venueRow] = await db
        .select({ name: venue.name })
        .from(venue)
        .where(eq(venue.id, existing.venueId))
        .limit(1);

      let decision;
      try {
        decision = Meetup.confirm(existing, {
          actorId: userId,
          venueName: venueRow?.name ?? "",
          conflictsCount: 0,
          now: new Date(),
        });
      } catch (err) {
        toTrpcError(err);
      }

      return commitAndEmit(async (tx) => {
        const [updated] = await tx
          .update(meetup)
          .set({ status: decision.state.status })
          .where(eq(meetup.id, existing.id))
          .returning();
        return { result: updated, events: toBuffered(decision.events) };
      });
    }),

  // #77 — Decline a pending proposal → reset to Matched state, emit MeetupDeclined
  declineProposal: protectedProcedure
    .input(z.object({ meetupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const existing = await loadMeetupSnapshot(input.meetupId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meetup not found" });
      }

      let decision;
      try {
        decision = Meetup.decline(existing, { actorId: userId, now: new Date() });
      } catch (err) {
        toTrpcError(err);
      }

      return commitAndEmit(async (tx) => {
        const [updated] = await tx
          .update(meetup)
          .set({ status: decision.state.status })
          .where(eq(meetup.id, existing.id))
          .returning();
        return { result: updated, events: toBuffered(decision.events) };
      });
    }),

  // #76 — Counter-propose: swap roles, update details, increment round, emit MeetupCounterProposed
  counterPropose: protectedProcedure
    .input(
      z.object({
        meetupId: z.string(),
        venueId: z.string(),
        scheduledAt: scheduledAtInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const existing = await loadMeetupSnapshot(input.meetupId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meetup not found" });
      }
      // #446 — block counter-proposing when the counterparty has deleted their account.
      await assertPartnerActive(existing.proposerId === userId ? existing.receiverId : existing.proposerId);
      const newVenue = await loadVenueSnapshot(input.venueId);

      let decision;
      try {
        decision = Meetup.counterPropose(existing, {
          actorId: userId,
          venue: newVenue,
          scheduledAt: input.scheduledAt,
          now: new Date(),
        });
      } catch (err) {
        toTrpcError(err);
      }

      const next = decision.state;
      return commitAndEmit(async (tx) => {
        const [updated] = await tx
          .update(meetup)
          .set({
            proposerId: next.proposerId,
            receiverId: next.receiverId,
            venueId: next.venueId,
            scheduledAt: next.scheduledAt,
            round: next.round,
          })
          .where(eq(meetup.id, existing.id))
          .returning();
        return { result: updated, events: toBuffered(decision.events) };
      });
    }),

  list: protectedProcedure
    .input(
      z.object({
        status: z
          .enum(["pending", "confirmed", "declined", "all"])
          .default("all"),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listMeetupsForUser(ctx.session.user.id, input.status);
    }),

  /**
   * Returns confirmed-meetup instants (as UTC `Date`s) that fall inside the
   * `[startIso, endIso)` range and involve either the current user or the
   * partner. The client builds candidate slot UTC instants itself (using its
   * device timezone) and filters those that match any returned blockedAt.
   */
  getAvailableSlots: protectedProcedure
    .input(
      z.object({
        partnerId: z.string(),
        startIso: z.iso.datetime(),
        endIso: z.iso.datetime(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const start = new Date(input.startIso);
      const end = new Date(input.endIso);

      const rows = await db
        .select({ scheduledAt: meetup.scheduledAt })
        .from(meetup)
        .where(
          and(
            gte(meetup.scheduledAt, start),
            lt(meetup.scheduledAt, end),
            eq(meetup.status, "confirmed"),
            or(
              eq(meetup.proposerId, userId),
              eq(meetup.receiverId, userId),
              eq(meetup.proposerId, input.partnerId),
              eq(meetup.receiverId, input.partnerId),
            ),
          ),
        );

      return rows.map((r) => r.scheduledAt);
    }),

  // #73 — Get the pending incoming proposal for me (where I am the current receiverId)
  getPendingIncoming: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [row] = await db
      .select({
        meetup: meetup,
        venue: {
          id: venue.id,
          name: venue.name,
          description: venue.description,
          photoUrl: venue.photoUrl,
        },
        proposer: {
          id: sql<string>`proposer.id`.as("pi_proposer_id"),
          name: sql<string>`proposer.name`.as("pi_proposer_name"),
          image: sql<string | null>`proposer.image`.as("pi_proposer_image"),
        },
      })
      .from(meetup)
      .innerJoin(venue, eq(meetup.venueId, venue.id))
      .innerJoin(sql`"user" as proposer`, sql`proposer.id = ${meetup.proposerId}`)
      // #367 — Skip proposals whose proposed datetime has already passed so the
      // receiver isn't offered a response to a dead proposal the proposer no
      // longer sees. Oldest-first selection is preserved among still-valid
      // proposals.
      .where(
        and(
          eq(meetup.receiverId, userId),
          eq(meetup.status, "pending"),
          gte(meetup.scheduledAt, new Date()),
        ),
      )
      .orderBy(meetup.createdAt)
      .limit(1);

    if (!row) return null;

    return {
      meetupId: row.meetup.id,
      round: row.meetup.round,
      canCounterPropose: row.meetup.round < 5,
      venue: row.venue,
      scheduledAt: row.meetup.scheduledAt,
      proposer: row.proposer,
    };
  }),

  pendingCount: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [result] = await db
      .select({ count: count() })
      .from(meetup)
      .where(
        and(
          eq(meetup.status, "pending"),
          or(eq(meetup.proposerId, userId), eq(meetup.receiverId, userId)),
        ),
      );

    return result?.count ?? 0;
  }),

  // #81/#85 — Cancel a confirmed meetup → cancelled status, emit MeetupCancelled
  cancelMeetup: protectedProcedure
    .input(z.object({ meetupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const existing = await loadMeetupSnapshot(input.meetupId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meetup not found" });
      }

      let decision;
      try {
        decision = Meetup.cancel(existing, { actorId: userId, now: new Date() });
      } catch (err) {
        toTrpcError(err);
      }

      return commitAndEmit(async (tx) => {
        const [updated] = await tx
          .update(meetup)
          .set({ status: decision.state.status })
          .where(eq(meetup.id, existing.id))
          .returning();
        return { result: updated, events: toBuffered(decision.events) };
      });
    }),

  // #399 — Withdraw a still-pending proposal (proposer-only) → cancelled status,
  // emit MeetupWithdrawn. Separate from cancelMeetup so a confirmed/completed
  // meetup can never be retracted here, and the receiver is never notified of a
  // "cancelled meetup" for a proposal that was never confirmed.
  withdrawMeetup: protectedProcedure
    .input(z.object({ meetupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const existing = await loadMeetupSnapshot(input.meetupId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meetup not found" });
      }

      let decision;
      try {
        decision = Meetup.withdraw(existing, { actorId: userId, now: new Date() });
      } catch (err) {
        toTrpcError(err);
      }

      return commitAndEmit(async (tx) => {
        const [updated] = await tx
          .update(meetup)
          .set({ status: decision.state.status })
          .where(eq(meetup.id, existing.id))
          .returning();
        return { result: updated, events: toBuffered(decision.events) };
      });
    }),

  // Query confirmed meetups for the current user
  getConfirmed: protectedProcedure.query(async ({ ctx }) => {
    return getConfirmedMeetupsForUser(ctx.session.user.id);
  }),

  // #86 — Propose a reschedule for a confirmed meetup
  proposeReschedule: protectedProcedure
    .input(
      z.object({
        meetupId: z.string(),
        venueId: z.string(),
        scheduledAt: scheduledAtInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const existing = await loadMeetupSnapshot(input.meetupId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meetup not found" });
      }
      // #446 — block rescheduling when the counterparty has deleted their account.
      await assertPartnerActive(existing.proposerId === userId ? existing.receiverId : existing.proposerId);
      const venueRow = await loadVenueSnapshot(input.venueId);

      let decision;
      try {
        decision = Meetup.proposeReschedule(existing, {
          actorId: userId,
          venue: venueRow,
          scheduledAt: input.scheduledAt,
          now: new Date(),
        });
      } catch (err) {
        toTrpcError(err);
      }

      const next = decision.state;
      return commitAndEmit(async (tx) => {
        const [updated] = await tx
          .update(meetup)
          .set({
            rescheduleProposerId: next.rescheduleProposerId,
            rescheduleVenueId: next.rescheduleVenueId,
            rescheduleScheduledAt: next.rescheduleScheduledAt,
          })
          .where(eq(meetup.id, existing.id))
          .returning();
        return { result: updated, events: toBuffered(decision.events) };
      });
    }),

  // #91 — Accept a reschedule proposal → update meetup details, emit MeetupRescheduled, notify both
  acceptReschedule: protectedProcedure
    .input(z.object({ meetupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const existing = await loadMeetupSnapshot(input.meetupId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meetup not found" });
      }
      let rescheduleVenueName = "";
      if (existing.rescheduleVenueId) {
        const [row] = await db
          .select({ name: venue.name })
          .from(venue)
          .where(eq(venue.id, existing.rescheduleVenueId))
          .limit(1);
        rescheduleVenueName = row?.name ?? "";
      }

      let decision;
      try {
        decision = Meetup.acceptReschedule(existing, {
          actorId: userId,
          rescheduleVenueName,
          now: new Date(),
        });
      } catch (err) {
        toTrpcError(err);
      }

      const next = decision.state;
      // Atomic guard preserved — only commit if reschedule is still pending.
      return commitAndEmit(async (tx) => {
        const [updated] = await tx
          .update(meetup)
          .set({
            venueId: next.venueId,
            scheduledAt: next.scheduledAt,
            rescheduleProposerId: null,
            rescheduleVenueId: null,
            rescheduleScheduledAt: null,
          })
          .where(
            and(eq(meetup.id, existing.id), sql`${meetup.rescheduleProposerId} IS NOT NULL`),
          )
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "The reschedule proposal was already handled by another request",
          });
        }

        return { result: updated, events: toBuffered(decision.events) };
      });
    }),

  // #93 — Decline a reschedule proposal → retain original details, emit MeetupRescheduleDeclined, notify both
  declineReschedule: protectedProcedure
    .input(z.object({ meetupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const existing = await loadMeetupSnapshot(input.meetupId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meetup not found" });
      }
      const [venueRow] = await db
        .select({ name: venue.name })
        .from(venue)
        .where(eq(venue.id, existing.venueId))
        .limit(1);

      let decision;
      try {
        decision = Meetup.declineReschedule(existing, {
          actorId: userId,
          venueName: venueRow?.name ?? "",
          now: new Date(),
        });
      } catch (err) {
        toTrpcError(err);
      }

      return commitAndEmit(async (tx) => {
        const [updated] = await tx
          .update(meetup)
          .set({
            rescheduleProposerId: null,
            rescheduleVenueId: null,
            rescheduleScheduledAt: null,
          })
          .where(
            and(eq(meetup.id, existing.id), sql`${meetup.rescheduleProposerId} IS NOT NULL`),
          )
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "The reschedule proposal was already handled by another request",
          });
        }

        return { result: updated, events: toBuffered(decision.events) };
      });
    }),

  // #97 — Record each Student's attendance report independently
  reportAttendance: protectedProcedure
    .input(
      z.object({
        meetupId: z.string(),
        attended: z.boolean(),
        rating: z.number().int().min(1).max(5).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const existing = await loadMeetupSnapshot(input.meetupId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meetup not found" });
      }
      const existingReports = await db
        .select({
          studentId: attendanceReport.studentId,
          attended: attendanceReport.attended,
        })
        .from(attendanceReport)
        .where(eq(attendanceReport.meetupId, input.meetupId));

      let decision;
      try {
        decision = Meetup.reportAttendance(existing, {
          actorId: userId,
          attended: input.attended,
          rating: input.rating ?? null,
          existingReports,
          now: new Date(),
        });
      } catch (err) {
        toTrpcError(err);
      }

      // Atomic: the attendance report, the meetup status transition, and the
      // cross-context match promotion must all commit or all roll back. A
      // mid-sequence failure previously left the report recorded while the
      // meetup/match state stayed inconsistent.
      const created = await commitAndEmit(async (tx) => {
        const [created] = await tx
          .insert(attendanceReport)
          .values({
            meetupId: input.meetupId,
            studentId: userId,
            attended: input.attended,
            rating: input.rating ?? null,
          })
          .returning();

        if (decision.outcome !== "pending") {
          await tx
            .update(meetup)
            .set({ status: decision.state.status })
            .where(eq(meetup.id, existing.id));
        }

        let promotedMatch = false;
        if (decision.outcome === "completed") {
          // Cross-context: promote the studentMatch to `connected`.
          const [matchRecord] = await tx
            .select({ id: studentMatch.id })
            .from(studentMatch)
            .where(
              or(
                and(
                  eq(studentMatch.studentAId, existing.proposerId),
                  eq(studentMatch.studentBId, existing.receiverId),
                ),
                and(
                  eq(studentMatch.studentAId, existing.receiverId),
                  eq(studentMatch.studentBId, existing.proposerId),
                ),
              ),
            )
            .limit(1);

          if (matchRecord) {
            await tx
              .update(studentMatch)
              .set({ status: "connected" })
              .where(eq(studentMatch.id, matchRecord.id));
            promotedMatch = true;
          }
        }

        // Enrich AttendanceReported with the freshly-persisted report id.
        const attendanceReportedIdx = decision.events.findIndex(
          (e) => e.name === "AttendanceReported",
        );
        if (attendanceReportedIdx !== -1 && created) {
          decision.events[attendanceReportedIdx]!.payload.reportId = created.id;
          decision.events[attendanceReportedIdx]!.payload.reportedAt = created.reportedAt;
        }
        const events = toBuffered(decision.events);

        if (promotedMatch) {
          // #138 — Prompt both Students to opt in to messaging after a completed meetup
          const [studentARow, studentBRow] = await Promise.all([
            tx.select({ name: user.name }).from(user).where(eq(user.id, existing.proposerId)).limit(1),
            tx.select({ name: user.name }).from(user).where(eq(user.id, existing.receiverId)).limit(1),
          ]);
          events.push({
            name: "MessagingOptInPrompted",
            payload: {
              meetupId: input.meetupId,
              studentAId: existing.proposerId,
              studentAName: studentARow[0]?.name ?? "Your match",
              studentBId: existing.receiverId,
              studentBName: studentBRow[0]?.name ?? "Your match",
              promptedAt: new Date(),
            },
          });
        }

        return { result: created, events };
      });

      return created;
    }),
});

// Re-export for tests that want to assert on the helper.
export { wallClockIn as __wallClockInForTests };
// Suppress unused-import warning if `inArray` was tree-shaken.
void inArray;
