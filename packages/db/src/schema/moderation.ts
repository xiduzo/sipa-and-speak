import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";

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

// Removed Students cannot re-register with the same institutional email.
export const blockedEmail = pgTable(
  "blocked_email",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull().unique(),
    blockedAt: timestamp("blocked_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("blocked_email_email_idx").on(table.email)],
);

// A Student reports a peer as disruptive for Moderator review.
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
    // Resolution metadata (null until flag is resolved)
    outcome: text("outcome"),          // warned | suspended | removed
    moderatorId: text("moderator_id").references(() => user.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("user_flag_reporter_idx").on(table.reporterId),
    index("user_flag_target_idx").on(table.targetId),
    index("user_flag_status_idx").on(table.status),
  ],
);

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
