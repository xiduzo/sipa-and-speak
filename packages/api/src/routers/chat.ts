import { and, desc, eq, lt, or } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@sip-and-speak/db";
import {
  conversation,
  message,
  messageReadStatus,
} from "@sip-and-speak/db/schema/sip-and-speak";
import { user } from "@sip-and-speak/db/schema/auth";
import { checkReadAccess, computeIsUnread, computeMarkReadAt } from "./messaging-utils";
import { protectedProcedure, router } from "../index";

export const chatRouter = router({
  listConversations: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Get all conversations the user is part of
    const conversations = await db
      .select()
      .from(conversation)
      .where(
        or(
          eq(conversation.user1Id, userId),
          eq(conversation.user2Id, userId),
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
        const hasUnread =
          lastMsg !== null &&
          (readStatus.length === 0 ||
            lastMsg.createdAt > readStatus[0].lastReadAt);

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

  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        content: z.string().min(1).max(2000),
      }),
    )
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

      const [newMessage] = await db
        .insert(message)
        .values({
          conversationId: input.conversationId,
          senderId: userId,
          content: input.content,
        })
        .returning();

      return newMessage;
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

      if (existing.length > 0) {
        // If greeting provided, send it as a message in the existing conversation
        if (input.greeting) {
          await db.insert(message).values({
            conversationId: existing[0].id,
            senderId: userId,
            content: input.greeting,
          });
        }
        return existing[0];
      }

      // Create new conversation
      const [newConversation] = await db
        .insert(conversation)
        .values({
          user1Id: userId,
          user2Id: input.partnerId,
        })
        .returning();

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
    const userId = ctx.session.user.id;

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

      if (lastMsg.length === 0) continue;

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

      if (
        readStatus.length === 0 ||
        lastMsg[0].createdAt > readStatus[0].lastReadAt
      ) {
        unreadCount++;
      }
    }

    return { count: unreadCount };
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
      const newLastReadAt = computeMarkReadAt(existing[0]?.lastReadAt ?? null, now);

      if (existing.length > 0) {
        await db
          .update(messageReadStatus)
          .set({ lastReadAt: newLastReadAt })
          .where(eq(messageReadStatus.id, existing[0].id));
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
