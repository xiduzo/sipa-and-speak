CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"user1_id" text NOT NULL,
	"user2_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "language_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"bio" text,
	"university" text,
	"age" integer,
	"latitude" double precision,
	"longitude" double precision,
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "language_profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "meetup" (
	"id" text PRIMARY KEY NOT NULL,
	"proposer_id" text NOT NULL,
	"receiver_id" text NOT NULL,
	"venue_id" text NOT NULL,
	"date" text NOT NULL,
	"time" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_read_status" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"last_read_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_interest" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"interest" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_language" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"language" text NOT NULL,
	"type" text NOT NULL,
	"proficiency" text
);
--> statement-breakpoint
CREATE TABLE "venue" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"photo_url" text,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_user1_id_user_id_fk" FOREIGN KEY ("user1_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_user2_id_user_id_fk" FOREIGN KEY ("user2_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "language_profile" ADD CONSTRAINT "language_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetup" ADD CONSTRAINT "meetup_proposer_id_user_id_fk" FOREIGN KEY ("proposer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetup" ADD CONSTRAINT "meetup_receiver_id_user_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetup" ADD CONSTRAINT "meetup_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_read_status" ADD CONSTRAINT "message_read_status_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_read_status" ADD CONSTRAINT "message_read_status_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interest" ADD CONSTRAINT "user_interest_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_language" ADD CONSTRAINT "user_language_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "conversation_user1_idx" ON "conversation" USING btree ("user1_id");--> statement-breakpoint
CREATE INDEX "conversation_user2_idx" ON "conversation" USING btree ("user2_id");--> statement-breakpoint
CREATE INDEX "meetup_proposerId_idx" ON "meetup" USING btree ("proposer_id");--> statement-breakpoint
CREATE INDEX "meetup_receiverId_idx" ON "meetup" USING btree ("receiver_id");--> statement-breakpoint
CREATE INDEX "meetup_date_idx" ON "meetup" USING btree ("date");--> statement-breakpoint
CREATE INDEX "message_conversationId_idx" ON "message" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "message_createdAt_idx" ON "message" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "message_read_conversationId_userId_idx" ON "message_read_status" USING btree ("conversation_id","user_id");--> statement-breakpoint
CREATE INDEX "user_interest_userId_idx" ON "user_interest" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_language_userId_idx" ON "user_language" USING btree ("user_id");