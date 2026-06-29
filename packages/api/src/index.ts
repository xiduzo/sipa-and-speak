import { env } from "@sip-and-speak/env/server";
import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

const moderatorEmails = new Set(
  env.MODERATOR_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

// Whether an email is in the MODERATOR_EMAILS allowlist. Shared by
// moderatorProcedure (tRPC authorization) and the sign-in domain gate
// (apps/server) so moderators can always reach a session regardless of
// their email domain.
export function isModeratorEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return moderatorEmails.has(email.trim().toLowerCase());
}

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
  if (!isModeratorEmail(ctx.session.user.email)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Moderator access required",
    });
  }
  return next({ ctx });
});
