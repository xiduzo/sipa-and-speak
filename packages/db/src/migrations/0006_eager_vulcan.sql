CREATE TABLE "attendance_report" (
	"id" text PRIMARY KEY NOT NULL,
	"meetup_id" text NOT NULL,
	"student_id" text NOT NULL,
	"attended" boolean NOT NULL,
	"reported_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_report_meetup_student_unique" UNIQUE("meetup_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "attendance_report" ADD CONSTRAINT "attendance_report_meetup_id_meetup_id_fk" FOREIGN KEY ("meetup_id") REFERENCES "public"."meetup"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_report" ADD CONSTRAINT "attendance_report_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_report_meetupId_idx" ON "attendance_report" USING btree ("meetup_id");