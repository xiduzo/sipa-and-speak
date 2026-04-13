import { and, eq, or, sql, count } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@sip-and-speak/db";
import { meetup, venue, studentMatch, attendanceReport } from "@sip-and-speak/db/schema/sip-and-speak";
import { protectedProcedure, router } from "../index";
import { domainEvents } from "../domain-events";
import { isMeetupInThePast, isRescheduleNoOp } from "./meetup-utils";

/** All bookable half-hour slots from 08:00 to 20:00 */
const ALL_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const totalMinutes = 8 * 60 + i * 30;
  const h = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const m = String(totalMinutes % 60).padStart(2, "0");
  return `${h}:${m}`;
});

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
        date: z.string(),
        time: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      if (userId === input.partnerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot propose a meetup with yourself" });
      }

      // #68: Matched state check
      const [matchRecord] = await db
        .select({ id: studentMatch.id })
        .from(studentMatch)
        .where(
          or(
            and(eq(studentMatch.studentAId, userId), eq(studentMatch.studentBId, input.partnerId)),
            and(eq(studentMatch.studentAId, input.partnerId), eq(studentMatch.studentBId, userId)),
          ),
        )
        .limit(1);
      if (!matchRecord) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only propose meetups with your matched partner" });
      }

      // #68: No duplicate pending proposal
      const [existingPending] = await db
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
        .limit(1);
      if (existingPending) {
        throw new TRPCError({ code: "CONFLICT", message: "A proposal is already awaiting a response from your partner" });
      }

      // #68: Active location check
      const [venueRecord] = await db
        .select({ id: venue.id, name: venue.name, isActive: venue.isActive })
        .from(venue)
        .where(eq(venue.id, input.venueId))
        .limit(1);
      if (!venueRecord) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Location not found" });
      }
      if (!venueRecord.isActive) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This location is no longer available. Please choose another." });
      }

      // #68: Future date/time check
      const proposedDateTime = new Date(`${input.date}T${input.time}:00`);
      if (proposedDateTime <= new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The proposed date and time must be in the future" });
      }

      // #69: Persist proposal with round=1
      const [created] = await db
        .insert(meetup)
        .values({
          proposerId: userId,
          receiverId: input.partnerId,
          venueId: input.venueId,
          date: input.date,
          time: input.time,
          status: "pending",
          round: 1,
        })
        .returning();

      // #69: Emit MeetupProposed event (fire and forget)
      domainEvents.emit("MeetupProposed", {
        meetupId: created!.id,
        proposerId: userId,
        receiverId: input.partnerId,
        venueName: venueRecord.name,
        date: input.date,
        time: input.time,
        proposedAt: new Date(),
      });

      return created;
    }),

  respond: protectedProcedure
    .input(
      z.object({
        meetupId: z.string(),
        action: z.enum(["accept", "decline"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const existing = await db.query.meetup.findFirst({
        where: eq(meetup.id, input.meetupId),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meetup not found",
        });
      }

      if (existing.receiverId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the receiver can respond to a meetup proposal",
        });
      }

      if (existing.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This meetup has already been responded to",
        });
      }

      // If accepting, check for conflicts with the receiver's confirmed meetups
      if (input.action === "accept") {
        const conflicts = await db
          .select({ id: meetup.id })
          .from(meetup)
          .where(
            and(
              eq(meetup.date, existing.date),
              eq(meetup.time, existing.time),
              eq(meetup.status, "confirmed"),
              or(
                eq(meetup.proposerId, userId),
                eq(meetup.receiverId, userId),
                eq(meetup.proposerId, existing.proposerId),
                eq(meetup.receiverId, existing.proposerId),
              ),
            ),
          );

        if (conflicts.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Scheduling conflict: one of the participants already has a confirmed meetup at this date and time",
          });
        }
      }

      const newStatus = input.action === "accept" ? "confirmed" : "declined";

      const [updated] = await db
        .update(meetup)
        .set({ status: newStatus })
        .where(eq(meetup.id, input.meetupId))
        .returning();

      return updated;
    }),

  // #76 — Counter-propose: swap roles, update details, increment round, emit MeetupCounterProposed
  counterPropose: protectedProcedure
    .input(
      z.object({
        meetupId: z.string(),
        venueId: z.string(),
        date: z.string(),
        time: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const [existing] = await db
        .select()
        .from(meetup)
        .innerJoin(venue, eq(meetup.venueId, venue.id))
        .where(eq(meetup.id, input.meetupId))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meetup not found" });
      }

      if (existing.meetup.receiverId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the current responder can counter-propose",
        });
      }

      if (existing.meetup.status !== "pending") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This proposal has already been responded to",
        });
      }

      // #73 — Reject counter-propose when round is already at 3
      if (existing.meetup.round >= 3) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Maximum counter-proposal rounds reached. You can only accept or decline.",
        });
      }

      // Reject no-op counter-proposal (same venue, date, and time)
      if (
        existing.meetup.venueId === input.venueId &&
        existing.meetup.date === input.date &&
        existing.meetup.time === input.time
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Counter-proposal must differ from the current proposal in at least one detail",
        });
      }

      // Future date/time validation
      const proposedDateTime = new Date(`${input.date}T${input.time}:00`);
      if (proposedDateTime <= new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The proposed date and time must be in the future" });
      }

      // Active venue check
      const [newVenue] = await db
        .select({ id: venue.id, name: venue.name, isActive: venue.isActive })
        .from(venue)
        .where(eq(venue.id, input.venueId))
        .limit(1);
      if (!newVenue) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Location not found" });
      }
      if (!newVenue.isActive) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This location is no longer available. Please choose another." });
      }

      // Swap proposer/receiver so original proposer now becomes the responder
      const newRound = existing.meetup.round + 1;
      const [updated] = await db
        .update(meetup)
        .set({
          proposerId: userId,
          receiverId: existing.meetup.proposerId,
          venueId: input.venueId,
          date: input.date,
          time: input.time,
          round: newRound,
        })
        .where(eq(meetup.id, input.meetupId))
        .returning();

      domainEvents.emit("MeetupCounterProposed", {
        meetupId: existing.meetup.id,
        newProposerId: userId,
        newReceiverId: existing.meetup.proposerId,
        venueName: newVenue.name,
        date: input.date,
        time: input.time,
        round: newRound,
        counterProposedAt: new Date(),
      });

      return updated;
    }),

  // #77 — Decline a pending proposal → reset to Matched state, emit MeetupDeclined
  declineProposal: protectedProcedure
    .input(z.object({ meetupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const [existing] = await db
        .select()
        .from(meetup)
        .where(eq(meetup.id, input.meetupId))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meetup not found" });
      }

      if (existing.receiverId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the current responder can decline this proposal",
        });
      }

      if (existing.status !== "pending") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This proposal has already been responded to",
        });
      }

      const [updated] = await db
        .update(meetup)
        .set({ status: "declined" })
        .where(eq(meetup.id, input.meetupId))
        .returning();

      // Pair returns to Matched state — no DB action needed, Matched state is
      // derived from studentMatch record existing with no pending meetup.
      domainEvents.emit("MeetupDeclined", {
        meetupId: existing.id,
        proposerId: existing.proposerId,
        receiverId: existing.receiverId,
        declinedAt: new Date(),
      });

      return updated;
    }),

  // #75 — Accept a pending proposal → confirm meetup, emit MeetupConfirmed
  acceptProposal: protectedProcedure
    .input(z.object({ meetupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const [existing] = await db
        .select()
        .from(meetup)
        .innerJoin(venue, eq(meetup.venueId, venue.id))
        .where(eq(meetup.id, input.meetupId))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meetup not found" });
      }

      if (existing.meetup.receiverId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the current responder can accept this proposal",
        });
      }

      if (existing.meetup.status !== "pending") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This proposal has already been responded to",
        });
      }

      const [updated] = await db
        .update(meetup)
        .set({ status: "confirmed" })
        .where(eq(meetup.id, input.meetupId))
        .returning();

      domainEvents.emit("MeetupConfirmed", {
        meetupId: existing.meetup.id,
        proposerId: existing.meetup.proposerId,
        receiverId: existing.meetup.receiverId,
        venueName: existing.venue.name,
        date: existing.meetup.date,
        time: existing.meetup.time,
        confirmedAt: new Date(),
      });

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
        .orderBy(meetup.createdAt);

      return rows.map((row) => {
        const isProposer = row.meetup.proposerId === userId;
        const partner = isProposer ? row.receiver : row.proposer;

        return {
          ...row.meetup,
          venue: row.venue,
          partner: {
            id: partner.id,
            name: partner.name,
            image: partner.image,
          },
        };
      });
    }),

  getAvailableSlots: protectedProcedure
    .input(
      z.object({
        partnerId: z.string(),
        date: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Get confirmed meetups for both users on this date
      const confirmedMeetups = await db
        .select({ time: meetup.time })
        .from(meetup)
        .where(
          and(
            eq(meetup.date, input.date),
            eq(meetup.status, "confirmed"),
            or(
              eq(meetup.proposerId, userId),
              eq(meetup.receiverId, userId),
              eq(meetup.proposerId, input.partnerId),
              eq(meetup.receiverId, input.partnerId),
            ),
          ),
        );

      const busyTimes = new Set(confirmedMeetups.map((m) => m.time));

      return ALL_SLOTS.filter((slot) => !busyTimes.has(slot));
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
      .where(and(eq(meetup.receiverId, userId), eq(meetup.status, "pending")))
      .orderBy(meetup.createdAt)
      .limit(1);

    if (!row) return null;

    return {
      meetupId: row.meetup.id,
      round: row.meetup.round,
      canCounterPropose: row.meetup.round < 3,
      venue: row.venue,
      date: row.meetup.date,
      time: row.meetup.time,
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

      const [existing] = await db
        .select()
        .from(meetup)
        .where(eq(meetup.id, input.meetupId))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meetup not found" });
      }

      const isParticipant =
        existing.proposerId === userId || existing.receiverId === userId;
      if (!isParticipant) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not a participant in this meetup" });
      }

      if (existing.status !== "confirmed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only confirmed meetups can be cancelled" });
      }

      // #81 — meetup must not have already occurred
      const meetupDateTime = new Date(`${existing.date}T${existing.time}:00`);
      if (meetupDateTime <= new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This meetup has already taken place and cannot be cancelled" });
      }

      const [updated] = await db
        .update(meetup)
        .set({ status: "cancelled" })
        .where(eq(meetup.id, input.meetupId))
        .returning();

      const otherStudentId =
        existing.proposerId === userId ? existing.receiverId : existing.proposerId;

      domainEvents.emit("MeetupCancelled", {
        meetupId: existing.id,
        cancelledById: userId,
        otherStudentId,
        cancelledAt: new Date(),
      });

      return updated;
    }),

  // Query confirmed meetups for the current user
  getConfirmed: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [rows, myReports] = await Promise.all([
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
            eq(meetup.status, "confirmed"),
            or(eq(meetup.proposerId, userId), eq(meetup.receiverId, userId)),
          ),
        )
        .orderBy(meetup.date, meetup.time),
      // #97 — Fetch this user's attendance reports
      db
        .select({ meetupId: attendanceReport.meetupId, attended: attendanceReport.attended })
        .from(attendanceReport)
        .where(eq(attendanceReport.studentId, userId)),
    ]);

    const myReportMap = new Map(myReports.map((r) => [r.meetupId, r.attended]));

    return rows.map((row) => ({
      meetupId: row.meetup.id,
      date: row.meetup.date,
      time: row.meetup.time,
      status: row.meetup.status,
      isPast: new Date(`${row.meetup.date}T${row.meetup.time}:00`) <= new Date(),
      venue: row.venue,
      partner: row.partner,
      // #86 — Reschedule proposal state
      reschedulePending: row.meetup.rescheduleProposerId !== null,
      rescheduleIsFromMe: row.meetup.rescheduleProposerId === userId,
      reschedule: row.meetup.rescheduleProposerId !== null
        ? {
            venueId: row.meetup.rescheduleVenueId!,
            date: row.meetup.rescheduleDate!,
            time: row.meetup.rescheduleTime!,
          }
        : null,
      // #97 — Attendance report state
      hasReported: myReportMap.has(row.meetup.id),
      myAttendance: myReportMap.get(row.meetup.id) ?? null,
    }));
  }),

  // #91 — Accept a reschedule proposal → update meetup details, emit MeetupRescheduled, notify both
  acceptReschedule: protectedProcedure
    .input(z.object({ meetupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const [existing] = await db
        .select()
        .from(meetup)
        .innerJoin(venue, eq(meetup.venueId, venue.id))
        .where(eq(meetup.id, input.meetupId))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meetup not found" });
      }

      const isParticipant =
        existing.meetup.proposerId === userId || existing.meetup.receiverId === userId;
      if (!isParticipant) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not a participant in this meetup" });
      }

      if (existing.meetup.status !== "confirmed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only confirmed meetups can have a reschedule accepted" });
      }

      if (existing.meetup.rescheduleProposerId === null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No reschedule proposal is pending for this meetup" });
      }

      if (existing.meetup.rescheduleProposerId === userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot accept your own reschedule proposal" });
      }

      // Fetch the reschedule venue for the notification body
      const [rescheduleVenue] = await db
        .select({ id: venue.id, name: venue.name })
        .from(venue)
        .where(eq(venue.id, existing.meetup.rescheduleVenueId!))
        .limit(1);

      // Atomic update: only succeeds if rescheduleProposerId is still set (race-condition guard)
      const [updated] = await db
        .update(meetup)
        .set({
          venueId: existing.meetup.rescheduleVenueId!,
          date: existing.meetup.rescheduleDate!,
          time: existing.meetup.rescheduleTime!,
          rescheduleProposerId: null,
          rescheduleVenueId: null,
          rescheduleDate: null,
          rescheduleTime: null,
        })
        .where(and(eq(meetup.id, input.meetupId), sql`${meetup.rescheduleProposerId} IS NOT NULL`))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "CONFLICT", message: "The reschedule proposal was already handled by another request" });
      }

      domainEvents.emit("MeetupRescheduled", {
        meetupId: existing.meetup.id,
        proposerId: existing.meetup.proposerId,
        receiverId: existing.meetup.receiverId,
        venueName: rescheduleVenue?.name ?? existing.venue.name,
        newDate: existing.meetup.rescheduleDate!,
        newTime: existing.meetup.rescheduleTime!,
        rescheduledAt: new Date(),
      });

      return updated;
    }),

  // #93 — Decline a reschedule proposal → retain original details, emit MeetupRescheduleDeclined, notify both
  declineReschedule: protectedProcedure
    .input(z.object({ meetupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const [existing] = await db
        .select()
        .from(meetup)
        .innerJoin(venue, eq(meetup.venueId, venue.id))
        .where(eq(meetup.id, input.meetupId))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meetup not found" });
      }

      const isParticipant =
        existing.meetup.proposerId === userId || existing.meetup.receiverId === userId;
      if (!isParticipant) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not a participant in this meetup" });
      }

      if (existing.meetup.status !== "confirmed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only confirmed meetups can have a reschedule declined" });
      }

      if (existing.meetup.rescheduleProposerId === null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No reschedule proposal is pending for this meetup" });
      }

      if (existing.meetup.rescheduleProposerId === userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot decline your own reschedule proposal" });
      }

      // Atomic update: only clears reschedule columns if rescheduleProposerId is still set
      const [updated] = await db
        .update(meetup)
        .set({
          rescheduleProposerId: null,
          rescheduleVenueId: null,
          rescheduleDate: null,
          rescheduleTime: null,
        })
        .where(and(eq(meetup.id, input.meetupId), sql`${meetup.rescheduleProposerId} IS NOT NULL`))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "CONFLICT", message: "The reschedule proposal was already handled by another request" });
      }

      domainEvents.emit("MeetupRescheduleDeclined", {
        meetupId: existing.meetup.id,
        proposerId: existing.meetup.proposerId,
        receiverId: existing.meetup.receiverId,
        venueName: existing.venue.name,
        originalDate: existing.meetup.date,
        originalTime: existing.meetup.time,
        declinedAt: new Date(),
      });

      return updated;
    }),

  // #86 — Propose a reschedule for a confirmed meetup
  proposeReschedule: protectedProcedure
    .input(
      z.object({
        meetupId: z.string(),
        venueId: z.string(),
        date: z.string(),
        time: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const [existing] = await db
        .select()
        .from(meetup)
        .where(eq(meetup.id, input.meetupId))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meetup not found" });
      }

      const isParticipant = existing.proposerId === userId || existing.receiverId === userId;
      if (!isParticipant) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not a participant in this meetup" });
      }

      if (existing.status !== "confirmed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only confirmed meetups can be rescheduled" });
      }

      // #87 — Meetup has already occurred
      if (isMeetupInThePast(existing.date, existing.time)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This meetup has already taken place and cannot be rescheduled" });
      }

      // #87 — Proposed date/time must be in the future
      if (isMeetupInThePast(input.date, input.time)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The rescheduled date and time must be in the future" });
      }

      // #87 — No-op: proposed details identical to current confirmed meetup
      if (isRescheduleNoOp(
        { venueId: existing.venueId, date: existing.date, time: existing.time },
        { venueId: input.venueId, date: input.date, time: input.time },
      )) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The proposed reschedule is identical to the current meetup. Please change at least one detail." });
      }

      // #87 — Race condition: another reschedule is already pending
      if (existing.rescheduleProposerId !== null) {
        throw new TRPCError({ code: "CONFLICT", message: "A reschedule request is already pending for this meetup. Please wait for your partner to respond." });
      }

      // #87 — Active location check
      const [venueRecord] = await db
        .select({ id: venue.id, name: venue.name, isActive: venue.isActive })
        .from(venue)
        .where(eq(venue.id, input.venueId))
        .limit(1);
      if (!venueRecord) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Location not found" });
      }
      if (!venueRecord.isActive) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This location is no longer available. Please choose another." });
      }

      const [updated] = await db
        .update(meetup)
        .set({
          rescheduleProposerId: userId,
          rescheduleVenueId: input.venueId,
          rescheduleDate: input.date,
          rescheduleTime: input.time,
        })
        .where(eq(meetup.id, input.meetupId))
        .returning();

      domainEvents.emit("MeetupRescheduleProposed", {
        meetupId: existing.id,
        proposerId: userId,
        receiverId: existing.proposerId === userId ? existing.receiverId : existing.proposerId,
        venueId: input.venueId,
        venueName: venueRecord.name,
        date: input.date,
        time: input.time,
        proposedAt: new Date(),
      });

      return updated;
    }),

  // #97 — Record each Student's attendance report independently
  reportAttendance: protectedProcedure
    .input(z.object({ meetupId: z.string(), attended: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const [existing] = await db
        .select()
        .from(meetup)
        .where(eq(meetup.id, input.meetupId))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meetup not found" });
      }

      const isParticipant =
        existing.proposerId === userId || existing.receiverId === userId;
      if (!isParticipant) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not a participant in this meetup" });
      }

      if (existing.status !== "confirmed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only confirmed meetups can receive attendance reports" });
      }

      // #96 — Reject self-report before the meetup's scheduled time has passed
      if (!isMeetupInThePast(existing.date, existing.time)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can only report attendance after the meetup's scheduled time has passed" });
      }

      // Check for duplicate report
      const [existingReport] = await db
        .select({ id: attendanceReport.id })
        .from(attendanceReport)
        .where(
          and(
            eq(attendanceReport.meetupId, input.meetupId),
            eq(attendanceReport.studentId, userId),
          ),
        )
        .limit(1);

      if (existingReport) {
        throw new TRPCError({ code: "CONFLICT", message: "You have already reported attendance for this meetup" });
      }

      const partnerId =
        existing.proposerId === userId ? existing.receiverId : existing.proposerId;

      const [created] = await db
        .insert(attendanceReport)
        .values({
          meetupId: input.meetupId,
          studentId: userId,
          attended: input.attended,
        })
        .returning();

      domainEvents.emit("AttendanceReported", {
        reportId: created!.id,
        meetupId: input.meetupId,
        studentId: userId,
        partnerId,
        attended: input.attended,
        reportedAt: created!.reportedAt,
      });

      // #99 — Check if both Students have now reported; trigger state transition if so
      const allReports = await db
        .select({ studentId: attendanceReport.studentId, attended: attendanceReport.attended })
        .from(attendanceReport)
        .where(eq(attendanceReport.meetupId, input.meetupId));

      if (allReports.length === 2) {
        const bothAttended = allReports.every((r) => r.attended);

        if (bothAttended) {
          // Both attended → transition to Connected state
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
            await Promise.all([
              db.update(meetup).set({ status: "completed" }).where(eq(meetup.id, input.meetupId)),
              db.update(studentMatch).set({ status: "connected" }).where(eq(studentMatch.id, matchRecord.id)),
            ]);

            domainEvents.emit("SipAndSpeakMomentCompleted", {
              meetupId: input.meetupId,
              studentAId: existing.proposerId,
              studentBId: existing.receiverId,
              completedAt: new Date(),
            });
          }
        } else {
          // #101 — At least one non-attendance → return pair to Matched (meetup closed)
          await db.update(meetup).set({ status: "not_attended" }).where(eq(meetup.id, input.meetupId));

          domainEvents.emit("MeetupNotAttended", {
            meetupId: input.meetupId,
            studentAId: existing.proposerId,
            studentBId: existing.receiverId,
            recordedAt: new Date(),
          });
        }
      }

      return created;
    }),
});
