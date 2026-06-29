CREATE TABLE "alumni" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "alumni_email_unique" UNIQUE("email")
);
