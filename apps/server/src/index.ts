import { trpcServer } from "@hono/trpc-server";
import { createContext } from "@sip-and-speak/api/context";
import { appRouter } from "@sip-and-speak/api/routers/index";
import { auth } from "@sip-and-speak/auth";
import { isAlumniEmail, ALUMNI_REGISTRY_UNAVAILABLE_ERROR } from "@sip-and-speak/auth/alumni-registry";
import { validateTueDomain, TUE_DOMAIN_ERROR } from "@sip-and-speak/auth/domain-validation";
import { env } from "@sip-and-speak/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use("/api/auth/email-otp/send-verification-otp", async (c, next) => {
  if (c.req.method !== "POST") return next();
  const body = await c.req.raw.clone().json().catch(() => ({})) as { email?: string };
  const email = body.email ?? "";

  // Allow TU/e institutional emails (student / staff enrolment path)
  if (validateTueDomain(email)) return next();

  // Allow verified alumni registry emails (alumni enrolment path)
  try {
    if (isAlumniEmail(email)) return next();
  } catch {
    return c.json({ message: ALUMNI_REGISTRY_UNAVAILABLE_ERROR }, 503);
  }

  return c.json({ message: TUE_DOMAIN_ERROR }, 400);
});

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  }),
);

app.get("/", (c) => {
  return c.text("OK");
});

export default app;
