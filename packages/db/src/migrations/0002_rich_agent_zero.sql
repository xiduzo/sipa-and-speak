CREATE TABLE "student_match" (
	"id" text PRIMARY KEY NOT NULL,
	"student_a_id" text NOT NULL,
	"student_b_id" text NOT NULL,
	"match_request_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_match" ADD CONSTRAINT "student_match_student_a_id_user_id_fk" FOREIGN KEY ("student_a_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_match" ADD CONSTRAINT "student_match_student_b_id_user_id_fk" FOREIGN KEY ("student_b_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_match" ADD CONSTRAINT "student_match_match_request_id_match_request_id_fk" FOREIGN KEY ("match_request_id") REFERENCES "public"."match_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_match_studentA_idx" ON "student_match" USING btree ("student_a_id");--> statement-breakpoint
CREATE INDEX "student_match_studentB_idx" ON "student_match" USING btree ("student_b_id");