import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";
import { meetup } from "./scheduling";

export const conversation = pgTable(
  "conversation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    user1Id: text("user1_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    user2Id: text("user2_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    meetupId: text("meetup_id").references(() => meetup.id, { onDelete: "set null" }),
    // Trust & Moderation can suspend; only "open" conversations accept messages.
    // Permanently removed Students cause conversations to be "closed" (read-only, history preserved).
    status: text("status", { enum: ["open", "suspended", "closed"] }).notNull().default("open"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("conversation_user1_idx").on(table.user1Id),
    index("conversation_user2_idx").on(table.user2Id),
    uniqueIndex("conversation_meetupId_idx").on(table.meetupId),
  ],
);

export const message = pgTable(
  "message",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("message_conversationId_idx").on(table.conversationId),
    index("message_createdAt_idx").on(table.createdAt),
  ],
);

export const messageReadStatus = pgTable(
  "message_read_status",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at").defaultNow().notNull(),
  },
  (table) => [
    index("message_read_conversationId_userId_idx").on(
      table.conversationId,
      table.userId,
    ),
  ],
);

// Each Student independently records their messaging accept/decline response.
export const messagingOptIn = pgTable(
  "messaging_opt_in",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    meetupId: text("meetup_id")
      .notNull()
      .references(() => meetup.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    response: text("response", { enum: ["accept", "decline"] }).notNull(),
    respondedAt: timestamp("responded_at").defaultNow().notNull(),
    // Set when this acceptance triggered a nudge push to the pending partner;
    // prevents duplicate nudges.
    nudgeSentAt: timestamp("nudge_sent_at"),
  },
  (table) => [
    unique("messaging_opt_in_meetup_student_unique").on(table.meetupId, table.studentId),
    index("messaging_opt_in_meetupId_idx").on(table.meetupId),
  ],
);

// Tracks whether a Student is actively viewing a conversation.
// activeUntil acts as a TTL — stale records (past activeUntil) are treated as inactive.
export const conversationPresence = pgTable(
  "conversation_presence",
  {
    studentId: text("student_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    activeUntil: timestamp("active_until").notNull(),
  },
  (table) => [
    unique("conversation_presence_student_conv_unique").on(table.studentId, table.conversationId),
    index("conversation_presence_studentId_idx").on(table.studentId),
  ],
);

export const conversationRelations = relations(conversation, ({ one, many }) => ({
  user1: one(user, {
    fields: [conversation.user1Id],
    references: [user.id],
    relationName: "conversationUser1",
  }),
  user2: one(user, {
    fields: [conversation.user2Id],
    references: [user.id],
    relationName: "conversationUser2",
  }),
  messages: many(message),
  messageReadStatuses: many(messageReadStatus),
}));

export const messageRelations = relations(message, ({ one }) => ({
  conversation: one(conversation, {
    fields: [message.conversationId],
    references: [conversation.id],
  }),
  sender: one(user, {
    fields: [message.senderId],
    references: [user.id],
  }),
}));

export const messageReadStatusRelations = relations(messageReadStatus, ({ one }) => ({
  conversation: one(conversation, {
    fields: [messageReadStatus.conversationId],
    references: [conversation.id],
  }),
  user: one(user, {
    fields: [messageReadStatus.userId],
    references: [user.id],
  }),
}));

export const messagingOptInRelations = relations(messagingOptIn, ({ one }) => ({
  meetup: one(meetup, {
    fields: [messagingOptIn.meetupId],
    references: [meetup.id],
  }),
  student: one(user, {
    fields: [messagingOptIn.studentId],
    references: [user.id],
  }),
}));
