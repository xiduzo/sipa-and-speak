ALTER TABLE "meetup" ADD COLUMN "reschedule_proposer_id" text;--> statement-breakpoint
ALTER TABLE "meetup" ADD COLUMN "reschedule_venue_id" text;--> statement-breakpoint
ALTER TABLE "meetup" ADD COLUMN "reschedule_date" text;--> statement-breakpoint
ALTER TABLE "meetup" ADD COLUMN "reschedule_time" text;--> statement-breakpoint
ALTER TABLE "meetup" ADD CONSTRAINT "meetup_reschedule_proposer_id_user_id_fk" FOREIGN KEY ("reschedule_proposer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetup" ADD CONSTRAINT "meetup_reschedule_venue_id_venue_id_fk" FOREIGN KEY ("reschedule_venue_id") REFERENCES "public"."venue"("id") ON DELETE set null ON UPDATE no action;