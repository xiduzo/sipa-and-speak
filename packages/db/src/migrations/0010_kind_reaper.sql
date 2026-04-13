ALTER TABLE "conversation" ADD COLUMN "meetup_id" text;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_meetup_id_meetup_id_fk" FOREIGN KEY ("meetup_id") REFERENCES "public"."meetup"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_meetupId_idx" ON "conversation" USING btree ("meetup_id");