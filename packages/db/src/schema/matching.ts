import {
  index,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";

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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("match_request_requesterId_idx").on(table.requesterId),
    index("match_request_receiverId_idx").on(table.receiverId),
  ],
);

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
    // Connected state: set to "connected" when both Students confirm attendance
    status: text("status", { enum: ["matched", "connected"] }).notNull().default("matched"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("student_match_studentA_idx").on(table.studentAId),
    index("student_match_studentB_idx").on(table.studentBId),
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
