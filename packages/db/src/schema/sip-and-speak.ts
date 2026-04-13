import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";

export const languageProfile = pgTable("language_profile", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  bio: text("bio"),
  university: text("university"),
  age: integer("age"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  onboardingComplete: boolean("onboarding_complete").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const userLanguage = pgTable(
  "user_language",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
    type: text("type", { enum: ["spoken", "learning"] }).notNull(),
    proficiency: text("proficiency", {
      enum: ["beginner", "intermediate", "advanced", "native"],
    }),
  },
  (table) => [index("user_language_userId_idx").on(table.userId)],
);

export const userInterest = pgTable(
  "user_interest",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    interest: text("interest", {
      enum: [
        "modern_art",
        "tech_coding",
        "jazz_music",
        "culinary_arts",
        "sustainability",
        "cinephile",
        "cosmology",
      ],
    }).notNull(),
  },
  (table) => [index("user_interest_userId_idx").on(table.userId)],
);

export const venue = pgTable("venue", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  photoUrl: text("photo_url"),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const meetup = pgTable(
  "meetup",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    proposerId: text("proposer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    receiverId: text("receiver_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    venueId: text("venue_id")
      .notNull()
      .references(() => venue.id),
    date: text("date").notNull(),
    time: text("time").notNull(),
    status: text("status", {
      enum: ["pending", "confirmed", "declined", "cancelled"],
    })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("meetup_proposerId_idx").on(table.proposerId),
    index("meetup_receiverId_idx").on(table.receiverId),
    index("meetup_date_idx").on(table.date),
  ],
);

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
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("conversation_user1_idx").on(table.user1Id),
    index("conversation_user2_idx").on(table.user2Id),
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


export const studentComment = pgTable(
  "student_comment",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "set null" }),
    targetId: text("target_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("student_comment_targetId_idx").on(table.targetId),
  ],
);

export const matchRequest = pgTable(
  "match_request",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    requesterId: text("requester_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    receiverId: text("receiver_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["pending", "accepted", "declined", "voided"],
    })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("match_request_requesterId_idx").on(table.requesterId),
    index("match_request_receiverId_idx").on(table.receiverId),
  ],
);

// --- Relations ---

export const languageProfileRelations = relations(languageProfile, ({ one }) => ({
  user: one(user, {
    fields: [languageProfile.userId],
    references: [user.id],
  }),
}));

export const userLanguageRelations = relations(userLanguage, ({ one }) => ({
  user: one(user, {
    fields: [userLanguage.userId],
    references: [user.id],
  }),
}));

export const userInterestRelations = relations(userInterest, ({ one }) => ({
  user: one(user, {
    fields: [userInterest.userId],
    references: [user.id],
  }),
}));

export const venueRelations = relations(venue, ({ many }) => ({
  meetups: many(meetup),
}));

export const meetupRelations = relations(meetup, ({ one }) => ({
  proposer: one(user, {
    fields: [meetup.proposerId],
    references: [user.id],
    relationName: "meetupProposer",
  }),
  receiver: one(user, {
    fields: [meetup.receiverId],
    references: [user.id],
    relationName: "meetupReceiver",
  }),
  venue: one(venue, {
    fields: [meetup.venueId],
    references: [venue.id],
  }),
}));

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

export const studentCommentRelations = relations(studentComment, ({ one }) => ({
  author: one(user, {
    fields: [studentComment.authorId],
    references: [user.id],
    relationName: "commentAuthor",
  }),
  target: one(user, {
    fields: [studentComment.targetId],
    references: [user.id],
    relationName: "commentTarget",
  }),
}));

export const matchRequestRelations = relations(matchRequest, ({ one }) => ({
  requester: one(user, {
    fields: [matchRequest.requesterId],
    references: [user.id],
    relationName: "matchRequester",
  }),
  receiver: one(user, {
    fields: [matchRequest.receiverId],
    references: [user.id],
    relationName: "matchReceiver",
  }),
}));

export const studentMatch = pgTable(
  "student_match",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    studentAId: text("student_a_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    studentBId: text("student_b_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    matchRequestId: text("match_request_id")
      .notNull()
      .references(() => matchRequest.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("student_match_studentA_idx").on(table.studentAId),
    index("student_match_studentB_idx").on(table.studentBId),
  ],
);

export const studentMatchRelations = relations(studentMatch, ({ one }) => ({
  studentA: one(user, {
    fields: [studentMatch.studentAId],
    references: [user.id],
    relationName: "studentMatchA",
  }),
  studentB: one(user, {
    fields: [studentMatch.studentBId],
    references: [user.id],
    relationName: "studentMatchB",
  }),
  matchRequest: one(matchRequest, {
    fields: [studentMatch.matchRequestId],
    references: [matchRequest.id],
  }),
}));
