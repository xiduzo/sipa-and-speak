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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
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
  (table) => [
    index("user_language_userId_idx").on(table.userId),
    unique("user_language_user_language_type_unique").on(table.userId, table.language, table.type),
  ],
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
        "photography",
        "board_games",
        "hiking_outdoors",
        "yoga_wellness",
        "literature",
        "entrepreneurship",
        "design_architecture",
        "travel",
        "gaming",
        "fitness_sports",
        "philosophy",
        "theatre",
        "grocery_shopping",
        "family_conversations",
        "pronunciation_practice",
      ],
    }).notNull(),
  },
  (table) => [
    index("user_interest_userId_idx").on(table.userId),
    unique("user_interest_user_interest_unique").on(table.userId, table.interest),
  ],
);

// Device token storage for push notifications. User-bound infrastructure;
// stays in identity until/unless a Notifications schema context emerges.
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_device_token_userId_token_idx").on(table.userId, table.token),
  ],
);

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
