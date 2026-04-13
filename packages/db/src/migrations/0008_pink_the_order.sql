CREATE TABLE "messaging_opt_in" (
	"id" text PRIMARY KEY NOT NULL,
	"meetup_id" text NOT NULL,
	"student_id" text NOT NULL,
	"response" text NOT NULL,
	"responded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "messaging_opt_in_meetup_student_unique" UNIQUE("meetup_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "messaging_opt_in" ADD CONSTRAINT "messaging_opt_in_meetup_id_meetup_id_fk" FOREIGN KEY ("meetup_id") REFERENCES "public"."meetup"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messaging_opt_in" ADD CONSTRAINT "messaging_opt_in_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messaging_opt_in_meetupId_idx" ON "messaging_opt_in" USING btree ("meetup_id");