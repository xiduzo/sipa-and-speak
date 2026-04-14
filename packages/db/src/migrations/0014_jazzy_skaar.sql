CREATE TABLE "blocked_email" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"blocked_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blocked_email_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "blocked_email_email_idx" ON "blocked_email" USING btree ("email");