import { env } from "@sip-and-speak/env/server";
import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

const moderatorEmails = new Set(
  env.MODERATOR_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

// Authorization for moderator/admin-only actions. Interim email allowlist
// (MODERATOR_EMAILS) until a role field is added to the user schema.
export const moderatorProcedure = protectedProcedure.use(({ ctx, next }) => {
  const email = ctx.session.user.email?.toLowerCase();
  if (!email || !moderatorEmails.has(email)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Moderator access required",
    });
  }
  return next({ ctx });
});
