import { eq, or } from "drizzle-orm";
import { db } from "@sip-and-speak/db";
import { conversation, messagingOptIn } from "@sip-and-speak/db/schema/conversation";
import { meetup } from "@sip-and-speak/db/schema/scheduling";
import { isMutuallyOptedIn } from "./messaging-utils";

export interface MeetupMessagingState {
  mine: "accept" | "decline" | null;
  partner: "accept" | "decline" | null;
  /** The messaging unlock rule (#141) applied to (mine, partner) — see `isMutuallyOptedIn`. */
  mutuallyOptedIn: boolean;
  conversationId: string | null;
}

/**
 * Returns per-meetup messaging state for every meetup the given Student is part of.
 * Owned by the Conversation context so other contexts (Scheduling) don't query
 * conversation/messagingOptIn tables directly.
 */
export async function getMessagingStateForUserMeetups(
  userId: string,
): Promise<Map<string, MeetupMessagingState>> {
  const [optIns, conversations] = await Promise.all([
    db
      .select({
        meetupId: messagingOptIn.meetupId,
        studentId: messagingOptIn.studentId,
        response: messagingOptIn.response,
      })
      .from(messagingOptIn)
      .innerJoin(meetup, eq(meetup.id, messagingOptIn.meetupId))
      .where(or(eq(meetup.proposerId, userId), eq(meetup.receiverId, userId))),
    db
      .select({ meetupId: conversation.meetupId, id: conversation.id })
      .from(conversation)
      .where(or(eq(conversation.user1Id, userId), eq(conversation.user2Id, userId))),
  ]);

  const result = new Map<string, MeetupMessagingState>();

  const emptyEntry = (): MeetupMessagingState => ({
    mine: null,
    partner: null,
    mutuallyOptedIn: false,
    conversationId: null,
  });

  for (const row of optIns) {
    const entry = result.get(row.meetupId) ?? emptyEntry();
    if (row.studentId === userId) entry.mine = row.response;
    else entry.partner = row.response;
    result.set(row.meetupId, entry);
  }

  for (const c of conversations) {
    if (c.meetupId === null) continue;
    const entry = result.get(c.meetupId) ?? emptyEntry();
    entry.conversationId = c.id;
    result.set(c.meetupId, entry);
  }

  for (const entry of result.values()) {
    entry.mutuallyOptedIn = isMutuallyOptedIn([entry.mine, entry.partner]);
  }

  return result;
}
