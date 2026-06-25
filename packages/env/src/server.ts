import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    POLAR_ACCESS_TOKEN: z.string().min(1),
    POLAR_SUCCESS_URL: z.url(),
    CORS_ORIGIN: z.url(),
    RESEND_API_KEY: z.string().min(1).optional(),
    RESEND_FROM: z.email().optional(),
    // Comma-separated allowlist of emails permitted to use moderator/admin
    // procedures (venue catalog, moderation actions). Interim authorization
    // until a role field is added to the user schema.
    MODERATOR_EMAILS: z.string().default(""),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
