import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, count, eq, ne } from "drizzle-orm";
import { db } from "@sip-and-speak/db";
import { meetup, venue } from "@sip-and-speak/db/schema/sip-and-speak";
import { protectedProcedure, router } from "../index";

async function assertNameUnique(name: string, excludeId?: string) {
  const existing = await db
    .select({ id: venue.id })
    .from(venue)
    .where(eq(venue.name, name));
  const conflict = existing.find((v) => v.id !== excludeId);
  if (conflict) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "A venue with this name already exists",
    });
  }
}

export const adminVenueRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        latitude: z.number(),
        longitude: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      await assertNameUnique(input.name);
      const [created] = await db
        .insert(venue)
        .values({
          name: input.name,
          description: input.description ?? null,
          latitude: input.latitude,
          longitude: input.longitude,
        })
        .returning();
      return created;
    }),

  findAll: protectedProcedure.query(async () => {
    return db.select().from(venue);
  }),

  findById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const [found] = await db
        .select()
        .from(venue)
        .where(eq(venue.id, input.id));
      if (!found) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Venue not found" });
      }
      return found;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.name) {
        await assertNameUnique(input.name, input.id);
      }
      const patch: Partial<typeof venue.$inferInsert> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.description !== undefined) patch.description = input.description;

      const [updated] = await db
        .update(venue)
        .set(patch)
        .where(eq(venue.id, input.id))
        .returning();
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Venue not found" });
      }
      return updated;
    }),

  deactivateWarnings: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const [pendingMeetupsResult, activeCountResult] = await Promise.all([
        db
          .select({ count: count() })
          .from(meetup)
          .where(
            and(
              eq(meetup.venueId, input.id),
              eq(meetup.status, "pending"),
            ),
          ),
        db
          .select({ count: count() })
          .from(venue)
          .where(and(eq(venue.isActive, true), ne(venue.id, input.id))),
      ]);

      return {
        hasPendingProposals: (pendingMeetupsResult[0]?.count ?? 0) > 0,
        isLastActive: (activeCountResult[0]?.count ?? 0) === 0,
      };
    }),

  deactivate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(venue)
        .set({ isActive: false })
        .where(eq(venue.id, input.id))
        .returning();
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Venue not found" });
      }
      return updated;
    }),

  reactivate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(venue)
        .set({ isActive: true })
        .where(eq(venue.id, input.id))
        .returning();
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Venue not found" });
      }
      return updated;
    }),
});
