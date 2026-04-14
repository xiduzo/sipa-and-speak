import { expo } from "@better-auth/expo";
import { polar, checkout, portal } from "@polar-sh/better-auth";
import { createDb } from "@sip-and-speak/db";
import * as schema from "@sip-and-speak/db/schema/auth";
import { env } from "@sip-and-speak/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { eq } from "drizzle-orm";

import { polarClient } from "./lib/payments";

export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",

      schema: schema,
    }),
    databaseHooks: {
      session: {
        create: {
          before: async (sessionData) => {
            // #108 — Block login for permanently removed Students
            const [userRow] = await db
              .select({ studentStatus: schema.user.studentStatus })
              .from(schema.user)
              .where(eq(schema.user.id, sessionData.userId))
              .limit(1);

            if (userRow?.studentStatus === "removed") {
              throw new Error("Your account is no longer active.");
            }
          },
        },
      },
      user: {
        create: {
          after: async (user) => {
            try {
              await polarClient.customers.create({ email: user.email, name: user.name ?? undefined });
            } catch (e) {
              console.error("[polar] customer creation failed for", user.email, e instanceof Error ? e.message : e);
            }
          },
        },
      },
    },
    trustedOrigins: [
      env.CORS_ORIGIN,
      "sip-and-speak://",
      ...(env.NODE_ENV === "development"
        ? ["exp://", "exp://**", "exp://192.168.*.*:*/**", "http://localhost:8081"]
        : []),
    ],
    emailAndPassword: {
      enabled: false,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [
      polar({
        client: polarClient,
        createCustomerOnSignUp: false, // handled in databaseHooks with error catching
        enableCustomerPortal: true,
        use: [
          checkout({
            products: [
              {
                productId: "your-product-id",
                slug: "pro",
              },
            ],
            successUrl: env.POLAR_SUCCESS_URL,
            authenticatedUsersOnly: true,
          }),
          portal(),
        ],
      }),
      expo(),
      emailOTP({
        expiresIn: 600, // 10 minutes
        async sendVerificationOTP({ email, otp, type }) {
          // TODO: Replace with real email provider (Resend, SendGrid, etc.)
          console.log(`[OTP] ${type} → ${email}: ${otp}`);
        },
      }),
    ],
  });
}

export const auth = createAuth();
