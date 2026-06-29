import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";

import { moderatorProcedure, router } from "../../index";
import { db } from "@sip-and-speak/db";
import { alumni } from "@sip-and-speak/db/schema/alumni";

// Email is normalized (lowercased + trimmed) before storage so lookups at
// sign-in time match exactly. Kept permissive on format (must contain "@") to
// stay compatible across zod versions.
const emailInput = z
  .string()
  .transform((value) => value.toLowerCase().trim())
  .refine((value) => value.length > 2 && value.includes("@"), {
    message: "Enter a valid email address.",
  });

export const alumniAdminRouter = router({
  /** List every alumni-registry entry, alphabetically by email. */
  findAll: moderatorProcedure.query(async () => {
    return db.select().from(alumni).orderBy(asc(alumni.email));
  }),

  /** Add an email to the alumni registry. Rejects duplicates. */
  add: moderatorProcedure
    .input(z.object({ email: emailInput }))
    .mutation(async ({ input }) => {
      const existing = await db
        .select({ id: alumni.id })
        .from(alumni)
        .where(eq(alumni.email, input.email))
        .limit(1);

      if (existing[0]) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This email is already in the alumni registry.",
        });
      }

      const [row] = await db
        .insert(alumni)
        .values({ email: input.email })
        .returning();

      return row!;
    }),

  /** Remove an entry from the alumni registry by id. Idempotent. */
  remove: moderatorProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.delete(alumni).where(eq(alumni.id, input.id));
      return { success: true as const };
    }),
});
