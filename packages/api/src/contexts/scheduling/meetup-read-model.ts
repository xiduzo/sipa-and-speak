/**
 * Meetup read model — the query side of the Meetup Scheduling context.
 *
 * The Meetup aggregate owns transitions (the write side). This module owns the
 * read side: the multi-join queries and row-shaping that turn raw meetup rows
 * plus their venue, the two participants, attendance reports, and messaging
 * opt-in state into the view shapes the native app renders.
 *
 * Pulling these out of the router gives the shaping a small interface
 * (`userId` [+ status]) over a large implementation (aliased self-joins on the
 * user table, partner resolution, deleted-account placeholders, attendance and
 * messaging enrichment) — and makes the shaping testable through the harness
 * without driving the full tRPC procedure.
 */
import { and, eq, or, sql, gte, desc } from "drizzle-orm";
import { db } from "@sip-and-speak/db";
import { meetup, venue, attendanceReport } from "@sip-and-speak/db/schema/scheduling";
import { getMessagingStateForUserMeetups } from "../conversation";

export type MeetupListStatus = "pending" | "confirmed" | "declined" | "all";

/**
 * Meetups where the user is proposer or receiver, newest first, shaped from the
 * user's perspective (the other party becomes `partner`). A pending proposal
 * whose currently-proposed datetime has passed is hidden (#367).
 */
export async function listMeetupsForUser(userId: string, status: MeetupListStatus) {
  const conditions = [
    or(eq(meetup.proposerId, userId), eq(meetup.receiverId, userId)),
  ];

  if (status !== "all") {
    conditions.push(eq(meetup.status, status));
  }

  // #367 — A pending proposal whose currently-proposed datetime has passed is
  // dead: hide it so the "Waiting for reply" card clears. scheduledAt always
  // reflects the latest round (counter-proposals overwrite it), so this guards
  // against the current datetime, never a stale earlier round. Confirmed/
  // declined rows are unaffected — they still surface in history regardless of
  // date.
  if (status === "pending") {
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
        deletedAt: sql<Date | null>`proposer.deleted_at`.as("proposer_deleted_at"),
      },
      receiver: {
        id: sql<string>`receiver.id`.as("receiver_id_alias"),
        name: sql<string>`receiver.name`.as("receiver_name"),
        image: sql<string | null>`receiver.image`.as("receiver_image"),
        deletedAt: sql<Date | null>`receiver.deleted_at`.as("receiver_deleted_at"),
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

    const partnerDeleted = partner.deletedAt !== null;

    return {
      ...row.meetup,
      isProposer,
      venue: row.venue,
      partner: {
        id: partner.id,
        // #447 — render deleted partners as an unavailable placeholder.
        name: partnerDeleted ? "Deleted user" : partner.name,
        image: partnerDeleted ? null : partner.image,
      },
      partnerDeleted,
    };
  });
}

/**
 * Confirmed and completed meetups for the user, newest first, enriched with the
 * user's own attendance report and the post-meetup messaging opt-in state. The
 * partner is resolved per-row via a CASE join so a single self-join covers both
 * proposer and receiver perspectives.
 */
export async function getConfirmedMeetupsForUser(userId: string) {
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
          deletedAt: sql<Date | null>`partner.deleted_at`.as("gc_partner_deleted_at"),
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
      .orderBy(desc(meetup.scheduledAt)),
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
    const messaging =
      messagingState.get(row.meetup.id) ?? { mine: null, partner: null, conversationId: null };
    const partnerDeleted = row.partner.deletedAt !== null;
    return {
      meetupId: row.meetup.id,
      scheduledAt: row.meetup.scheduledAt,
      status: row.meetup.status,
      isPast: row.meetup.scheduledAt <= now,
      venue: row.venue,
      // #447 — render deleted partners as an unavailable placeholder.
      partner: {
        id: row.partner.id,
        name: partnerDeleted ? "Deleted user" : row.partner.name,
        image: partnerDeleted ? null : row.partner.image,
      },
      partnerDeleted,
      // #86 — Reschedule proposal state
      reschedulePending: row.meetup.rescheduleProposerId !== null,
      rescheduleIsFromMe: row.meetup.rescheduleProposerId === userId,
      reschedule:
        row.meetup.rescheduleProposerId !== null && row.meetup.rescheduleScheduledAt
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
}
