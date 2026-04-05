import { and, eq, or, sql, count } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@sip-and-speak/db";
import { meetup, venue } from "@sip-and-speak/db/schema/sip-and-speak";
import { user } from "@sip-and-speak/db/schema/auth";
import { protectedProcedure, router } from "../index";

/** All bookable half-hour slots from 08:00 to 20:00 */
const ALL_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const totalMinutes = 8 * 60 + i * 30;
  const h = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const m = String(totalMinutes % 60).padStart(2, "0");
  return `${h}:${m}`;
});

export const meetupRouter = router({
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
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot propose a meetup with yourself",
        });
      }

      // Check for scheduling conflicts for either participant
      const conflicts = await db
        .select({ id: meetup.id })
        .from(meetup)
        .where(
          and(
            eq(meetup.date, input.date),
            eq(meetup.time, input.time),
            eq(meetup.status, "confirmed"),
            or(
              eq(meetup.proposerId, userId),
              eq(meetup.receiverId, userId),
              eq(meetup.proposerId, input.partnerId),
              eq(meetup.receiverId, input.partnerId),
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

      const [created] = await db
        .insert(meetup)
        .values({
          proposerId: userId,
          receiverId: input.partnerId,
          venueId: input.venueId,
          date: input.date,
          time: input.time,
          status: "pending",
        })
        .returning();

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
});
