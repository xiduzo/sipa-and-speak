-- Custom migration: move meetup.date+time → meetup.scheduled_at (timestamptz),
-- move meetup.reschedule_date+reschedule_time → meetup.reschedule_scheduled_at,
-- and convert all existing wall-clock `timestamp` columns to `timestamptz`.
--
-- Existing meetup wall-clock rows are interpreted as Europe/Amsterdam local
-- (the host's zone). Existing audit/system timestamps were written by drizzle
-- as UTC instants serialized into a no-tz column, so they convert with
-- `AT TIME ZONE 'UTC'`.
--
-- Notes:
--   * Auth tables (user/session/account/verification) are owned by better-auth
--     and intentionally not touched.
--   * Drizzle's meta snapshot may report drift on next `db:generate` — accept
--     "do nothing / column already in target shape" prompts.

-- ─── meetup: replace date/time text with scheduled_at timestamptz ─────────────
ALTER TABLE "meetup" ADD COLUMN "scheduled_at" timestamp with time zone;
ALTER TABLE "meetup" ADD COLUMN "reschedule_scheduled_at" timestamp with time zone;

UPDATE "meetup"
SET "scheduled_at" = (("date" || ' ' || "time" || ':00')::timestamp AT TIME ZONE 'Europe/Amsterdam');

UPDATE "meetup"
SET "reschedule_scheduled_at" = (("reschedule_date" || ' ' || "reschedule_time" || ':00')::timestamp AT TIME ZONE 'Europe/Amsterdam')
WHERE "reschedule_date" IS NOT NULL AND "reschedule_time" IS NOT NULL;

ALTER TABLE "meetup" ALTER COLUMN "scheduled_at" SET NOT NULL;

DROP INDEX IF EXISTS "meetup_date_idx";
CREATE INDEX "meetup_scheduledAt_idx" ON "meetup" USING btree ("scheduled_at");

ALTER TABLE "meetup" DROP COLUMN "date";
ALTER TABLE "meetup" DROP COLUMN "time";
ALTER TABLE "meetup" DROP COLUMN "reschedule_date";
ALTER TABLE "meetup" DROP COLUMN "reschedule_time";

-- ─── meetup: audit timestamps → timestamptz ──────────────────────────────────
ALTER TABLE "meetup" ALTER COLUMN "created_at" TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "meetup" ALTER COLUMN "updated_at" TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';

-- ─── venue ───────────────────────────────────────────────────────────────────
ALTER TABLE "venue" ALTER COLUMN "created_at" TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "venue" ALTER COLUMN "updated_at" TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';

-- ─── attendance_report ───────────────────────────────────────────────────────
ALTER TABLE "attendance_report" ALTER COLUMN "reported_at" TYPE timestamp with time zone USING "reported_at" AT TIME ZONE 'UTC';

-- ─── identity ────────────────────────────────────────────────────────────────
ALTER TABLE "language_profile" ALTER COLUMN "created_at" TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "language_profile" ALTER COLUMN "updated_at" TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "user_device_token" ALTER COLUMN "created_at" TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "user_device_token" ALTER COLUMN "updated_at" TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';

-- ─── matching ────────────────────────────────────────────────────────────────
ALTER TABLE "match_request" ALTER COLUMN "created_at" TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "match_request" ALTER COLUMN "updated_at" TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "student_match" ALTER COLUMN "created_at" TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';

-- ─── moderation ──────────────────────────────────────────────────────────────
ALTER TABLE "student_comment" ALTER COLUMN "created_at" TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "blocked_email" ALTER COLUMN "blocked_at" TYPE timestamp with time zone USING "blocked_at" AT TIME ZONE 'UTC';
ALTER TABLE "user_flag" ALTER COLUMN "resolved_at" TYPE timestamp with time zone USING "resolved_at" AT TIME ZONE 'UTC';
ALTER TABLE "user_flag" ALTER COLUMN "created_at" TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';

-- ─── conversation ────────────────────────────────────────────────────────────
ALTER TABLE "conversation" ALTER COLUMN "created_at" TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "message" ALTER COLUMN "created_at" TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "message_read_status" ALTER COLUMN "last_read_at" TYPE timestamp with time zone USING "last_read_at" AT TIME ZONE 'UTC';
ALTER TABLE "messaging_opt_in" ALTER COLUMN "responded_at" TYPE timestamp with time zone USING "responded_at" AT TIME ZONE 'UTC';
ALTER TABLE "messaging_opt_in" ALTER COLUMN "nudge_sent_at" TYPE timestamp with time zone USING "nudge_sent_at" AT TIME ZONE 'UTC';
ALTER TABLE "conversation_presence" ALTER COLUMN "active_until" TYPE timestamp with time zone USING "active_until" AT TIME ZONE 'UTC';
