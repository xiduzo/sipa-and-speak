import { expo } from "@better-auth/expo";
import { polar, checkout, portal } from "@polar-sh/better-auth";
import { createDb } from "@sip-and-speak/db";
import * as schema from "@sip-and-speak/db/schema/auth";
import { env } from "@sip-and-speak/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { Resend } from "resend";

import { renderVerificationOtpEmail } from "./emails";
import { polarClient } from "./lib/payments";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

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
              // Polar processes member email+name. It is NOT yet listed on the
              // Privacy Statement because it runs in sandbox (not production member
              // data). It MUST be added as a sub-processor (US, SCCs, GDPR Art. 46)
              // on /privacy before Polar is enabled in production.
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
      "exp://*",
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
          // Log the code for local debugging only — never in production.
          if (env.NODE_ENV !== "production") {
            console.log(`[OTP] ${type} → ${email}: ${otp}`);
          }

          if (!resend || !env.RESEND_FROM) {
            return;
          }

          try {
            const rendered = await renderVerificationOtpEmail(otp);
            await resend.emails.send({
              from: env.RESEND_FROM,
              to: email,
              subject: rendered.subject,
              html: rendered.html,
              text: rendered.text,
            });
          } catch (e) {
            console.error("[resend] OTP send failed for", email, e instanceof Error ? e.message : e);
          }
        },
      }),
    ],
  });
}

export const auth = createAuth();
