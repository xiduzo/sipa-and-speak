-- pg-mem-compatible reduction of 0018_timezone_migration.sql.
-- pg-mem cannot parse `AT TIME ZONE`, `ALTER COLUMN ... TYPE timestamptz USING ...`,
-- or the data-backfill UPDATEs that depend on them. The test DB is always empty
-- when migrations run, so we only need to land the FINAL schema shape: drop the
-- old text columns, add the new timestamptz columns. The `timestamp` vs
-- `timestamptz` distinction is irrelevant in-memory.

ALTER TABLE "meetup" DROP COLUMN "date";
ALTER TABLE "meetup" DROP COLUMN "time";
ALTER TABLE "meetup" DROP COLUMN "reschedule_date";
ALTER TABLE "meetup" DROP COLUMN "reschedule_time";
ALTER TABLE "meetup" ADD COLUMN "scheduled_at" timestamp NOT NULL DEFAULT now();
ALTER TABLE "meetup" ADD COLUMN "reschedule_scheduled_at" timestamp;

DROP INDEX IF EXISTS "meetup_date_idx";
CREATE INDEX "meetup_scheduledAt_idx" ON "meetup" ("scheduled_at");
