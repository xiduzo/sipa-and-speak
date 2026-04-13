import { trpcServer } from "@hono/trpc-server";
import { createContext } from "@sip-and-speak/api/context";
import { appRouter } from "@sip-and-speak/api/routers/index";
import { auth } from "@sip-and-speak/auth";
import { isAlumniEmail, ALUMNI_REGISTRY_ERROR, ALUMNI_REGISTRY_UNAVAILABLE_ERROR } from "@sip-and-speak/auth/alumni-registry";
import { validateTueDomain } from "@sip-and-speak/auth/domain-validation";
import { env } from "@sip-and-speak/env/server";
import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { registerNotificationHandlers } from "./notifications";

// Wire domain event → push notification handlers on server start
registerNotificationHandlers();

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

async function handleSendOtp(c: Context): Promise<Response> {
  // Read raw body ONCE — avoids consuming the stream twice
  const rawBody = await c.req.raw.text().catch(() => "{}");
  const email: string = (() => {
    try { return (JSON.parse(rawBody) as { email?: string }).email ?? ""; }
    catch { return ""; }
  })();

  if (validateTueDomain(email)) {
    // Valid TU/e institutional email — proceed to OTP dispatch
    const newReq = new Request(c.req.raw, { body: rawBody });
    return auth.handler(newReq);
  }

  // Not a TU/e domain — check the alumni registry
  let isAlumni: boolean;
  try {
    isAlumni = isAlumniEmail(email);
  } catch {
    return c.json({ message: ALUMNI_REGISTRY_UNAVAILABLE_ERROR }, 503);
  }

  if (!isAlumni) {
    return c.json({ message: ALUMNI_REGISTRY_ERROR }, 400);
  }

  // Re-create request with buffered body so auth.handler can read it
  const newReq = new Request(c.req.raw, { body: rawBody });
  return auth.handler(newReq);
}

app.post("/api/auth/email-otp/send-verification-otp", handleSendOtp);
app.post("/api/auth/sign-in/email-otp", async (c) => {
  const res = await auth.handler(c.req.raw);
  if (res.status >= 500) {
    console.error("[auth sign-in 500]", await res.clone().text());
  }
  return res;
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

app.onError((err, c) => {
  console.error("[server error]", err);
  return c.json({ message: err.message }, 500);
});

export default app;
