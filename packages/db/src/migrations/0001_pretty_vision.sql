CREATE TABLE "match_request" (
	"id" text PRIMARY KEY NOT NULL,
	"requester_id" text NOT NULL,
	"receiver_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"target_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_request" ADD CONSTRAINT "match_request_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_request" ADD CONSTRAINT "match_request_receiver_id_user_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_comment" ADD CONSTRAINT "student_comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_comment" ADD CONSTRAINT "student_comment_target_id_user_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_request_requesterId_idx" ON "match_request" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "match_request_receiverId_idx" ON "match_request" USING btree ("receiver_id");--> statement-breakpoint
CREATE INDEX "student_comment_targetId_idx" ON "student_comment" USING btree ("target_id");