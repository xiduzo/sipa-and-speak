import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@sip-and-speak/db";
import { conversation, message, messageReadStatus, messagingOptIn } from "@sip-and-speak/db/schema/conversation";
import { meetup } from "@sip-and-speak/db/schema/scheduling";
import {
  checkReadAccess,
  computeIsUnread,
  computeMarkReadAt,
  isMutuallyOptedIn,
} from "./messaging-utils";
import {
  listConversationsForUser,
  listEntriesForUser,
  unreadCountForUser,
} from "./chat-read-model";
import { protectedProcedure, router } from "../../index";

export const chatRouter = router({
  listConversations: protectedProcedure.query(async ({ ctx }) => {
    return listConversationsForUser(ctx.session.user.id);
  }),

  getMessages: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify user is part of this conversation
      const conv = await db
        .select()
        .from(conversation)
        .where(
          and(
            eq(conversation.id, input.conversationId),
            or(
              eq(conversation.user1Id, userId),
              eq(conversation.user2Id, userId),
            ),
          ),
        )
        .limit(1);

      const access = checkReadAccess(conv[0], userId);
      if (!access.allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: access.error });
      }

      const conditions = [eq(message.conversationId, input.conversationId)];

      if (input.cursor) {
        conditions.push(lt(message.id, input.cursor));
      }

      const messages = await db
        .select()
        .from(message)
        .where(and(...conditions))
        .orderBy(desc(message.createdAt))
        .limit(input.limit + 1);

      const hasMore = messages.length > input.limit;
      const items = hasMore ? messages.slice(0, input.limit) : messages;

      // Fetch viewer's read status for isUnread computation (#148)
      const readStatusRows = await db
        .select({ lastReadAt: messageReadStatus.lastReadAt })
        .from(messageReadStatus)
        .where(
          and(
            eq(messageReadStatus.conversationId, input.conversationId),
            eq(messageReadStatus.userId, userId),
          ),
        )
        .limit(1);
      const lastReadAt = readStatusRows[0]?.lastReadAt ?? null;

      const chronological = items.reverse();
      return {
        messages: chronological.map((msg) => ({
          ...msg,
          isUnread: computeIsUnread(msg, userId, lastReadAt),
        })),
        nextCursor: hasMore ? chronological[chronological.length - 1]?.id : undefined,
      };
    }),

  startConversation: protectedProcedure
    .input(
      z.object({
        partnerId: z.string(),
        greeting: z.string().min(1).max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      if (input.partnerId === userId) {
        throw new Error("Cannot start a conversation with yourself");
      }

      // Authorization: messaging is only unlocked when the two students share a
      // meetup where BOTH opted in to accept (#139-141). Without this guard any
      // authenticated user could open a conversation with — and message — anyone.
      const sharedMeetups = await db
        .select({ id: meetup.id })
        .from(meetup)
        .where(
          or(
            and(eq(meetup.proposerId, userId), eq(meetup.receiverId, input.partnerId)),
            and(eq(meetup.proposerId, input.partnerId), eq(meetup.receiverId, userId)),
          ),
        );

      let mutuallyOptedIn = false;
      if (sharedMeetups.length > 0) {
        // One query for all shared meetups, then the unlock predicate per meetup in JS.
        const optInRows = await db
          .select({ meetupId: messagingOptIn.meetupId, response: messagingOptIn.response })
          .from(messagingOptIn)
          .where(inArray(messagingOptIn.meetupId, sharedMeetups.map((m) => m.id)));
        const responsesByMeetup = new Map<string, ("accept" | "decline")[]>();
        for (const row of optInRows) {
          const list = responsesByMeetup.get(row.meetupId) ?? [];
          list.push(row.response);
          responsesByMeetup.set(row.meetupId, list);
        }
        mutuallyOptedIn = sharedMeetups.some((m) =>
          isMutuallyOptedIn(responsesByMeetup.get(m.id) ?? []),
        );
      }

      if (!mutuallyOptedIn) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Messaging is not unlocked with this student.",
        });
      }

      // Check if conversation already exists (in either direction)
      const existing = await db
        .select()
        .from(conversation)
        .where(
          or(
            and(
              eq(conversation.user1Id, userId),
              eq(conversation.user2Id, input.partnerId),
            ),
            and(
              eq(conversation.user1Id, input.partnerId),
              eq(conversation.user2Id, userId),
            ),
          ),
        )
        .limit(1);

      const existingConversation = existing[0];
      if (existingConversation) {
        // If greeting provided, send it as a message in the existing conversation
        if (input.greeting) {
          await db.insert(message).values({
            conversationId: existingConversation.id,
            senderId: userId,
            content: input.greeting,
          });
        }
        return existingConversation;
      }

      // Create new conversation
      const [newConversation] = await db
        .insert(conversation)
        .values({
          user1Id: userId,
          user2Id: input.partnerId,
        })
        .returning();

      if (!newConversation) {
        throw new Error("Failed to create conversation");
      }

      // Send greeting message if provided
      if (input.greeting) {
        await db.insert(message).values({
          conversationId: newConversation.id,
          senderId: userId,
          content: input.greeting,
        });
      }

      return newConversation;
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return unreadCountForUser(ctx.session.user.id);
  }),

  listEntries: protectedProcedure.query(async ({ ctx }) => {
    return listEntriesForUser(ctx.session.user.id);
  }),

  markRead: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify user is part of this conversation
      const conv = await db
        .select()
        .from(conversation)
        .where(
          and(
            eq(conversation.id, input.conversationId),
            or(
              eq(conversation.user1Id, userId),
              eq(conversation.user2Id, userId),
            ),
          ),
        )
        .limit(1);

      if (conv.length === 0) {
        throw new Error("Conversation not found");
      }

      // Upsert read status
      const existing = await db
        .select()
        .from(messageReadStatus)
        .where(
          and(
            eq(messageReadStatus.conversationId, input.conversationId),
            eq(messageReadStatus.userId, userId),
          ),
        )
        .limit(1);

      const now = new Date();
      const existingStatus = existing[0];
      const newLastReadAt = computeMarkReadAt(existingStatus?.lastReadAt ?? null, now);

      if (existingStatus) {
        await db
          .update(messageReadStatus)
          .set({ lastReadAt: newLastReadAt })
          .where(eq(messageReadStatus.id, existingStatus.id));
      } else {
        await db.insert(messageReadStatus).values({
          conversationId: input.conversationId,
          userId,
          lastReadAt: newLastReadAt,
        });
      }

      return { lastReadAt: newLastReadAt };
    }),
});
