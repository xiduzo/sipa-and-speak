import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  unique,
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

export const venue = pgTable(
  "venue",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    description: text("description"),
    photoUrl: text("photo_url"),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    tags: text("tags").array().notNull().default([]),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("venue_name_idx").on(table.name)],
);

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
      enum: ["pending", "confirmed", "declined", "cancelled", "completed", "not_attended"],
    })
      .notNull()
      .default("pending"),
    round: integer("round").default(1).notNull(),
    // #86 — Reschedule proposal (nullable; set when a Student proposes rescheduling a confirmed meetup)
    rescheduleProposerId: text("reschedule_proposer_id").references(() => user.id, { onDelete: "set null" }),
    rescheduleVenueId: text("reschedule_venue_id").references(() => venue.id, { onDelete: "set null" }),
    rescheduleDate: text("reschedule_date"),
    rescheduleTime: text("reschedule_time"),
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
    // #141 — FK to meetup; unique per meetup (at most one conversation per meetup pair)
    meetupId: text("meetup_id").references(() => meetup.id, { onDelete: "set null" }),
    // #146 — Trust & Moderation can suspend a conversation; only "open" conversations accept messages
    status: text("status", { enum: ["open", "suspended"] }).notNull().default("open"),
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

// #130 — Device token storage for push notifications
export const userDeviceToken = pgTable(
  "user_device_token",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: text("platform", { enum: ["ios", "android", "web"] }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_device_token_userId_token_idx").on(table.userId, table.token),
  ],
);

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
    // #99 — Connected state: set to "connected" when both Students confirm attendance
    status: text("status", { enum: ["matched", "connected"] }).notNull().default("matched"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("student_match_studentA_idx").on(table.studentAId),
    index("student_match_studentB_idx").on(table.studentBId),
  ],
);

// #97 — Attendance report: each Student independently reports after a meetup
export const attendanceReport = pgTable(
  "attendance_report",
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
    attended: boolean("attended").notNull(),
    reportedAt: timestamp("reported_at").defaultNow().notNull(),
  },
  (table) => [
    unique("attendance_report_meetup_student_unique").on(table.meetupId, table.studentId),
    index("attendance_report_meetupId_idx").on(table.meetupId),
  ],
);

// #139 — Messaging opt-in: each Student independently records their accept/decline response
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
    // #140 — Set when this acceptance triggered a nudge push to the pending partner; prevents duplicate nudges
    nudgeSentAt: timestamp("nudge_sent_at"),
  },
  (table) => [
    unique("messaging_opt_in_meetup_student_unique").on(table.meetupId, table.studentId),
    index("messaging_opt_in_meetupId_idx").on(table.meetupId),
  ],
);

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

// #153 — Presence record: tracks whether a Student is actively viewing a conversation
// activeUntil acts as a TTL — stale records (past activeUntil) are treated as inactive
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

// #67/#72 — Flag: a Student reports a peer as disruptive for Moderator review
export const userFlag = pgTable(
  "user_flag",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetId: text("target_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    detail: text("detail"),
    status: text("status").notNull().default("open"), // open | resolved
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("user_flag_reporter_idx").on(table.reporterId),
    index("user_flag_target_idx").on(table.targetId),
    index("user_flag_status_idx").on(table.status),
  ],
);
