import type { EventEmitter } from "events";
import { and, eq, or, sql, count, gte, lt, inArray, desc } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@sip-and-speak/db";
import { meetup, venue, attendanceReport } from "@sip-and-speak/db/schema/scheduling";
import { studentMatch } from "@sip-and-speak/db/schema/matching";
import { getMessagingStateForUserMeetups } from "../conversation";
import { user } from "@sip-and-speak/db/schema/auth";
import { protectedProcedure, router } from "../../index";
import { domainEvents } from "../../domain-events";
import {
  Meetup,
  MeetupRuleError,
  type DomainEventToEmit,
  type MeetupSnapshot,
  type VenueSnapshot,
} from "./meetup-aggregate";

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

/**
 * Replay aggregate events through the global domain-events emitter. We dodge
 * the per-event generic by routing through the base `EventEmitter.emit`.
 *
 * For events that carry `scheduledAt` (Date), we also enrich the payload with
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

function emit(events: DomainEventToEmit[], extraPayload: Record<string, unknown> = {}): void {
  const emitter = domainEvents as unknown as EventEmitter;
  for (const e of events) {
    emitter.emit(e.name, enrichPayload({ ...e.payload, ...extraPayload }));
  }
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

      const [created] = await db.insert(meetup).values(decision.row).returning();
      emit(decision.events, { meetupId: created!.id });
      return created;
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
        const [updated] = await db
          .update(meetup)
          .set({ status: decision.state.status })
          .where(eq(meetup.id, existing.id))
          .returning();
        emit(decision.events);
        return updated;
      }

      // decline path
      let decision;
      try {
        decision = Meetup.decline(existing, { actorId: userId, now: new Date() });
      } catch (err) {
        toTrpcError(err);
      }
      const [updated] = await db
        .update(meetup)
        .set({ status: decision.state.status })
        .where(eq(meetup.id, existing.id))
        .returning();
      emit(decision.events);
      return updated;
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

      const [updated] = await db
        .update(meetup)
        .set({ status: decision.state.status })
        .where(eq(meetup.id, existing.id))
        .returning();
      emit(decision.events);
      return updated;
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

      const [updated] = await db
        .update(meetup)
        .set({ status: decision.state.status })
        .where(eq(meetup.id, existing.id))
        .returning();
      emit(decision.events);
      return updated;
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
      const [updated] = await db
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
      emit(decision.events);
      return updated;
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
      const userId = ctx.session.user.id;

      const conditions = [
        or(eq(meetup.proposerId, userId), eq(meetup.receiverId, userId)),
      ];

      if (input.status !== "all") {
        conditions.push(eq(meetup.status, input.status));
      }

      // #367 — A pending proposal whose currently-proposed datetime has passed
      // is dead: hide it so the "Waiting for reply" card clears. scheduledAt
      // always reflects the latest round (counter-proposals overwrite it), so
      // this guards against the current datetime, never a stale earlier round.
      // Confirmed/declined rows are unaffected — they still surface in history
      // regardless of date.
      if (input.status === "pending") {
        conditions.push(gte(meetup.scheduledAt, new Date()));
      }

      const rows = await db
        .select({
          meetup: meetup,
          venue: {
            id: venue.id,
            name: venue.name,
            photoUrl: venue.photoUrl,
          },
          proposer: {
            id: sql<string>`proposer.id`.as("proposer_id_alias"),
            name: sql<string>`proposer.name`.as("proposer_name"),
            image: sql<string | null>`proposer.image`.as("proposer_image"),
          },
          receiver: {
            id: sql<string>`receiver.id`.as("receiver_id_alias"),
            name: sql<string>`receiver.name`.as("receiver_name"),
            image: sql<string | null>`receiver.image`.as("receiver_image"),
          },
        })
        .from(meetup)
        .innerJoin(venue, eq(meetup.venueId, venue.id))
        .innerJoin(
          sql`"user" as proposer`,
          sql`proposer.id = ${meetup.proposerId}`,
        )
        .innerJoin(
          sql`"user" as receiver`,
          sql`receiver.id = ${meetup.receiverId}`,
        )
        .where(and(...conditions))
        .orderBy(desc(meetup.createdAt));

      return rows.map((row) => {
        const isProposer = row.meetup.proposerId === userId;
        const partner = isProposer ? row.receiver : row.proposer;

        return {
          ...row.meetup,
          isProposer,
          venue: row.venue,
          partner: {
            id: partner.id,
            name: partner.name,
            image: partner.image,
          },
        };
      });
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

      const [updated] = await db
        .update(meetup)
        .set({ status: decision.state.status })
        .where(eq(meetup.id, existing.id))
        .returning();
      emit(decision.events);
      return updated;
    }),

  // Query confirmed meetups for the current user
  getConfirmed: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [rows, myReports, messagingState] = await Promise.all([
      db
        .select({
          meetup: meetup,
          venue: {
            id: venue.id,
            name: venue.name,
            description: venue.description,
            photoUrl: venue.photoUrl,
          },
          partner: {
            id: sql<string>`partner.id`.as("gc_partner_id"),
            name: sql<string>`partner.name`.as("gc_partner_name"),
            image: sql<string | null>`partner.image`.as("gc_partner_image"),
          },
        })
        .from(meetup)
        .innerJoin(venue, eq(meetup.venueId, venue.id))
        .innerJoin(
          sql`"user" as partner`,
          sql`partner.id = CASE WHEN ${meetup.proposerId} = ${userId} THEN ${meetup.receiverId} ELSE ${meetup.proposerId} END`,
        )
        .where(
          and(
            or(eq(meetup.status, "confirmed"), eq(meetup.status, "completed")),
            or(eq(meetup.proposerId, userId), eq(meetup.receiverId, userId)),
          ),
        )
        .orderBy(meetup.scheduledAt),
      // #97 — Fetch this user's attendance reports
      db
        .select({
          meetupId: attendanceReport.meetupId,
          attended: attendanceReport.attended,
          rating: attendanceReport.rating,
        })
        .from(attendanceReport)
        .where(eq(attendanceReport.studentId, userId)),
      // Conversation context owns its own data — Scheduling consumes the surface
      getMessagingStateForUserMeetups(userId),
    ]);

    const myReportMap = new Map(myReports.map((r) => [r.meetupId, r]));
    const now = new Date();

    return rows.map((row) => {
      const myReport = myReportMap.get(row.meetup.id);
      const messaging = messagingState.get(row.meetup.id) ?? { mine: null, partner: null, conversationId: null };
      return {
        meetupId: row.meetup.id,
        scheduledAt: row.meetup.scheduledAt,
        status: row.meetup.status,
        isPast: row.meetup.scheduledAt <= now,
        venue: row.venue,
        partner: row.partner,
        // #86 — Reschedule proposal state
        reschedulePending: row.meetup.rescheduleProposerId !== null,
        rescheduleIsFromMe: row.meetup.rescheduleProposerId === userId,
        reschedule: row.meetup.rescheduleProposerId !== null && row.meetup.rescheduleScheduledAt
          ? {
              venueId: row.meetup.rescheduleVenueId!,
              scheduledAt: row.meetup.rescheduleScheduledAt,
            }
          : null,
        // #97 — Attendance report state
        hasReported: myReport !== undefined,
        myAttendance: myReport?.attended ?? null,
        myRating: myReport?.rating ?? null,
        // Messaging opt-in state for post-meetup hero
        optIn: {
          mine: messaging.mine,
          partner: messaging.partner,
          conversationId: messaging.conversationId,
        },
      };
    });
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
      const [updated] = await db
        .update(meetup)
        .set({
          rescheduleProposerId: next.rescheduleProposerId,
          rescheduleVenueId: next.rescheduleVenueId,
          rescheduleScheduledAt: next.rescheduleScheduledAt,
        })
        .where(eq(meetup.id, existing.id))
        .returning();
      emit(decision.events);
      return updated;
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
      const [updated] = await db
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

      emit(decision.events);
      return updated;
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

      const [updated] = await db
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

      emit(decision.events);
      return updated;
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

      const [created] = await db
        .insert(attendanceReport)
        .values({
          meetupId: input.meetupId,
          studentId: userId,
          attended: input.attended,
          rating: input.rating ?? null,
        })
        .returning();

      // Outcome may transition the meetup status. Cross-context match update +
      // messaging opt-in prompt remain in the router because they touch tables
      // outside the Scheduling aggregate.
      if (decision.outcome !== "pending") {
        await db
          .update(meetup)
          .set({ status: decision.state.status })
          .where(eq(meetup.id, existing.id));
      }

      // Enrich AttendanceReported with the freshly-persisted report id.
      const attendanceReportedIdx = decision.events.findIndex(
        (e) => e.name === "AttendanceReported",
      );
      if (attendanceReportedIdx !== -1 && created) {
        decision.events[attendanceReportedIdx]!.payload.reportId = created.id;
        decision.events[attendanceReportedIdx]!.payload.reportedAt = created.reportedAt;
      }
      emit(decision.events);

      if (decision.outcome === "completed") {
        // Cross-context: promote the studentMatch to `connected` and prompt
        // both Students to opt in to messaging.
        const [matchRecord] = await db
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
          await db
            .update(studentMatch)
            .set({ status: "connected" })
            .where(eq(studentMatch.id, matchRecord.id));

          const [studentARow, studentBRow] = await Promise.all([
            db.select({ name: user.name }).from(user).where(eq(user.id, existing.proposerId)).limit(1),
            db.select({ name: user.name }).from(user).where(eq(user.id, existing.receiverId)).limit(1),
          ]);
          // #138 — Prompt both Students to opt in to messaging after a completed meetup
          domainEvents.emit("MessagingOptInPrompted", {
            meetupId: input.meetupId,
            studentAId: existing.proposerId,
            studentAName: studentARow[0]?.name ?? "Your match",
            studentBId: existing.receiverId,
            studentBName: studentBRow[0]?.name ?? "Your match",
            promptedAt: new Date(),
          });
        }
      }

      return created;
    }),
});

// Re-export for tests that want to assert on the helper.
export { wallClockIn as __wallClockInForTests };
// Suppress unused-import warning if `inArray` was tree-shaken.
void inArray;
