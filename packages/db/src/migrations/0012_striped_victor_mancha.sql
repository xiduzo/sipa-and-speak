CREATE TABLE "conversation_presence" (
	"student_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"active_until" timestamp NOT NULL,
	CONSTRAINT "conversation_presence_student_conv_unique" UNIQUE("student_id","conversation_id")
);
--> statement-breakpoint
CREATE TABLE "user_flag" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_id" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text NOT NULL,
	"detail" text,
	"status" text DEFAULT 'open' NOT NULL,
	"outcome" text,
	"moderator_id" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_presence" ADD CONSTRAINT "conversation_presence_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_presence" ADD CONSTRAINT "conversation_presence_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_flag" ADD CONSTRAINT "user_flag_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_flag" ADD CONSTRAINT "user_flag_target_id_user_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_flag" ADD CONSTRAINT "user_flag_moderator_id_user_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_presence_studentId_idx" ON "conversation_presence" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "user_flag_reporter_idx" ON "user_flag" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "user_flag_target_idx" ON "user_flag" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "user_flag_status_idx" ON "user_flag" USING btree ("status");