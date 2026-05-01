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

// Each Student independently reports attendance after a meetup
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
    rating: integer("rating"),
    reportedAt: timestamp("reported_at").defaultNow().notNull(),
  },
  (table) => [
    unique("attendance_report_meetup_student_unique").on(table.meetupId, table.studentId),
    index("attendance_report_meetupId_idx").on(table.meetupId),
  ],
);

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
