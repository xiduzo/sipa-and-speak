/**
 * Chat read model — the query side of the Conversation context.
 *
 * The chat router owns the write side and the access checks (which stay split
 * by design — read collapses every failure to NOT_A_PARTICIPANT to hide
 * existence, write surfaces precise errors; see ADR-0004). This module owns the
 * read side: the multi-table joins and row-shaping that turn raw conversation,
 * message, read-status, meetup, venue, attendance, and messaging-opt-in rows
 * into the view shapes the native app's chat list and inbox render.
 *
 * Pulling these out of the router gives the shaping a small interface (`userId`)
 * over a large implementation (partner resolution, last-message / unread
 * enrichment, locked-meetup phase derivation, and per-partner dedupe) — and
 * makes the shaping testable through the harness without driving the full tRPC
 * procedure.
 */
import { and, desc, eq, or, inArray, sql } from "drizzle-orm";
import { db } from "@sip-and-speak/db";
import { conversation, message, messageReadStatus, messagingOptIn } from "@sip-and-speak/db/schema/conversation";
import { meetup, venue, attendanceReport } from "@sip-and-speak/db/schema/scheduling";
import { user } from "@sip-and-speak/db/schema/auth";
import { deriveLockedPhase, keptEntryKeysByPartner } from "./messaging-utils";

/**
 * Open conversations the user is part of, each enriched with the partner, the
 * last message, and the viewer's unread state, sorted by most recent activity.
 * Suspended conversations are excluded (#157).
 */
export async function listConversationsForUser(userId: string) {
  // Get all open conversations the user is part of (#157 — suspended excluded)
  const conversations = await db
    .select()
    .from(conversation)
    .where(
      and(
        eq(conversation.status, "open"),
        or(
          eq(conversation.user1Id, userId),
          eq(conversation.user2Id, userId),
        ),
      ),
    );

  const results = await Promise.all(
    conversations.map(async (conv) => {
      const partnerId =
        conv.user1Id === userId ? conv.user2Id : conv.user1Id;

      const partner = await db
        .select({ id: user.id, name: user.name, image: user.image })
        .from(user)
        .where(eq(user.id, partnerId))
        .limit(1);

      const lastMessage = await db
        .select()
        .from(message)
        .where(eq(message.conversationId, conv.id))
        .orderBy(desc(message.createdAt))
        .limit(1);

      const readStatus = await db
        .select()
        .from(messageReadStatus)
        .where(
          and(
            eq(messageReadStatus.conversationId, conv.id),
            eq(messageReadStatus.userId, userId),
          ),
        )
        .limit(1);

      const lastMsg = lastMessage[0] ?? null;
      const readEntry = readStatus[0];
      const hasUnread =
        lastMsg !== null &&
        (readEntry === undefined ||
          lastMsg.createdAt > readEntry.lastReadAt);

      return {
        id: conv.id,
        partner: partner[0] ?? null,
        lastMessage: lastMsg,
        hasUnread,
        createdAt: conv.createdAt,
      };
    }),
  );

  // Sort by last message date descending (most recent first)
  return results.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt?.getTime() ?? a.createdAt.getTime();
    const bTime = b.lastMessage?.createdAt?.getTime() ?? b.createdAt.getTime();
    return bTime - aTime;
  });
}

/**
 * Number of conversations (in any status) whose last message the user has not
 * yet read. A conversation with no messages never counts.
 */
export async function unreadCountForUser(userId: string) {
  // Get all conversations the user is part of
  const conversations = await db
    .select({ id: conversation.id })
    .from(conversation)
    .where(
      or(
        eq(conversation.user1Id, userId),
        eq(conversation.user2Id, userId),
      ),
    );

  if (conversations.length === 0) {
    return { count: 0 };
  }

  let unreadCount = 0;

  for (const conv of conversations) {
    const lastMsg = await db
      .select({ createdAt: message.createdAt })
      .from(message)
      .where(eq(message.conversationId, conv.id))
      .orderBy(desc(message.createdAt))
      .limit(1);

    const lastEntry = lastMsg[0];
    if (!lastEntry) continue;

    const readStatus = await db
      .select({ lastReadAt: messageReadStatus.lastReadAt })
      .from(messageReadStatus)
      .where(
        and(
          eq(messageReadStatus.conversationId, conv.id),
          eq(messageReadStatus.userId, userId),
        ),
      )
      .limit(1);

    const readEntry = readStatus[0];
    if (readEntry === undefined || lastEntry.createdAt > readEntry.lastReadAt) {
      unreadCount++;
    }
  }

  return { count: unreadCount };
}

/**
 * The unified inbox: open conversations (enriched like {@link
 * listConversationsForUser}) plus "locked" cards for confirmed/completed/
 * not_attended meetups that have no open conversation yet, each tagged with its
 * messaging phase. Collapsed to one row per partner, with locked cards floated
 * above open chats in phase order.
 */
export async function listEntriesForUser(userId: string) {
  const now = new Date();

  const [openConversations, lockedMeetups, myReports, optIns] = await Promise.all([
    db
      .select({
        id: conversation.id,
        user1Id: conversation.user1Id,
        user2Id: conversation.user2Id,
        meetupId: conversation.meetupId,
        createdAt: conversation.createdAt,
      })
      .from(conversation)
      .where(
        and(
          eq(conversation.status, "open"),
          or(eq(conversation.user1Id, userId), eq(conversation.user2Id, userId)),
        ),
      ),
    db
      .select({
        meetup: meetup,
        venue: { id: venue.id, name: venue.name, photoUrl: venue.photoUrl },
        partner: {
          id: sql<string>`partner.id`.as("le_partner_id"),
          name: sql<string>`partner.name`.as("le_partner_name"),
          image: sql<string | null>`partner.image`.as("le_partner_image"),
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
          inArray(meetup.status, ["confirmed", "completed", "not_attended"]),
          or(eq(meetup.proposerId, userId), eq(meetup.receiverId, userId)),
        ),
      ),
    db
      .select({ meetupId: attendanceReport.meetupId })
      .from(attendanceReport)
      .where(eq(attendanceReport.studentId, userId)),
    db
      .select({
        meetupId: messagingOptIn.meetupId,
        studentId: messagingOptIn.studentId,
        response: messagingOptIn.response,
      })
      .from(messagingOptIn)
      .innerJoin(meetup, eq(meetup.id, messagingOptIn.meetupId))
      .where(or(eq(meetup.proposerId, userId), eq(meetup.receiverId, userId))),
  ]);

  const myReportSet = new Set(myReports.map((r) => r.meetupId));
  const optInByMeetup = new Map<
    string,
    { mine: "accept" | "decline" | null; partner: "accept" | "decline" | null }
  >();
  for (const row of optIns) {
    const entry = optInByMeetup.get(row.meetupId) ?? { mine: null, partner: null };
    if (row.studentId === userId) entry.mine = row.response;
    else entry.partner = row.response;
    optInByMeetup.set(row.meetupId, entry);
  }

  const conversationByMeetup = new Map(
    openConversations
      .filter((c) => c.meetupId !== null)
      .map((c) => [c.meetupId as string, c]),
  );

  // Open entries — enrich each conversation with partner/lastMessage/hasUnread
  const openEntries = await Promise.all(
    openConversations.map(async (conv) => {
      const partnerId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
      const [partner, lastMessageRows, readStatusRows] = await Promise.all([
        db
          .select({ id: user.id, name: user.name, image: user.image })
          .from(user)
          .where(eq(user.id, partnerId))
          .limit(1),
        db
          .select()
          .from(message)
          .where(eq(message.conversationId, conv.id))
          .orderBy(desc(message.createdAt))
          .limit(1),
        db
          .select({ lastReadAt: messageReadStatus.lastReadAt })
          .from(messageReadStatus)
          .where(
            and(
              eq(messageReadStatus.conversationId, conv.id),
              eq(messageReadStatus.userId, userId),
            ),
          )
          .limit(1),
      ]);

      const lastMessage = lastMessageRows[0] ?? null;
      const lastReadAt = readStatusRows[0]?.lastReadAt ?? null;
      const hasUnread =
        lastMessage !== null &&
        (lastReadAt === null || lastMessage.createdAt > lastReadAt);

      return {
        kind: "open" as const,
        id: conv.id,
        conversationId: conv.id,
        meetupId: conv.meetupId,
        partner: partner[0] ?? null,
        lastMessage,
        hasUnread,
        sortAt: lastMessage?.createdAt ?? conv.createdAt,
      };
    }),
  );

  // Locked entries — confirmed/completed/not_attended meetups without an open conversation
  const lockedEntries = lockedMeetups
    .filter((row) => !conversationByMeetup.has(row.meetup.id))
    .map((row) => {
      const meetupAt = row.meetup.scheduledAt;
      const optIn = optInByMeetup.get(row.meetup.id) ?? { mine: null, partner: null };
      const phase = deriveLockedPhase({
        meetupStatus: row.meetup.status as "confirmed" | "completed" | "not_attended",
        meetupAt,
        now,
        hasMyAttendanceReport: myReportSet.has(row.meetup.id),
        myOptIn: optIn.mine,
        partnerOptIn: optIn.partner,
      });
      return {
        kind: "locked" as const,
        id: row.meetup.id,
        meetupId: row.meetup.id,
        partner: row.partner,
        venue: row.venue,
        meetupAt: meetupAt.toISOString(),
        phase,
        sortAt: meetupAt,
      };
    });

  // Collapse to one row per partner so a user met more than once isn't repeated.
  const keptKeys = keptEntryKeysByPartner([...lockedEntries, ...openEntries]);
  const keepEntry = (entry: { kind: "open" | "locked"; id: string }) =>
    keptKeys.has(`${entry.kind}-${entry.id}`);

  // Locked entries float above open chats: pre-meet (soonest first), then post-meet awaiting,
  // then declined. Open chats below, ordered by most recent activity.
  const phaseRank: Record<string, number> = {
    scheduled: 0,
    awaiting_attendance: 1,
    awaiting_partner_attendance: 2,
    awaiting_my_optin: 3,
    awaiting_partner_optin: 4,
    declined: 5,
  };
  const sortedLocked = lockedEntries.filter(keepEntry).sort((a, b) => {
    const r = (phaseRank[a.phase] ?? 99) - (phaseRank[b.phase] ?? 99);
    if (r !== 0) return r;
    return a.sortAt.getTime() - b.sortAt.getTime();
  });
  const sortedOpen = openEntries.filter(keepEntry).sort(
    (a, b) => b.sortAt.getTime() - a.sortAt.getTime(),
  );
  return [...sortedLocked, ...sortedOpen].map(({ sortAt: _omit, ...rest }) => rest);
}
