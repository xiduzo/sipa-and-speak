import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// TU/e alumni registry — non-institutional emails that are permitted to
// register despite not matching the TU/e domain gate. Managed from the admin
// interface. Emails are stored normalized (lowercased + trimmed); the unique
// constraint enforces exact-match lookups at sign-in time.
export const alumni = pgTable("alumni", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
