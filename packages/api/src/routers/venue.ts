import { z } from "zod";
import { db } from "@sip-and-speak/db";
import { venue } from "@sip-and-speak/db/schema/sip-and-speak";
import { protectedProcedure, router } from "../index";
import { haversineDistance } from "./matching";

const venueTagEnum = z.enum(["wifi", "quiet_zone", "campus", "outdoor", "vibrant"]);

export const venueRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        latitude: z.number(),
        longitude: z.number(),
        tags: z.array(venueTagEnum).optional(),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      const allVenues = await db.select().from(venue);

      // Filter by tags if provided
      let filtered = allVenues;
      if (input.tags && input.tags.length > 0) {
        filtered = filtered.filter((v) =>
          input.tags!.some((tag) => v.tags.includes(tag)),
        );
      }

      // Compute distance and sort by proximity
      const withDistance = filtered.map((v) => ({
        ...v,
        distance: Math.round(
          haversineDistance(input.latitude, input.longitude, v.latitude, v.longitude) * 10,
        ) / 10,
      }));

      withDistance.sort((a, b) => a.distance - b.distance);

      // Cursor-based pagination (cursor = index offset as string)
      const startIndex = input.cursor ? parseInt(input.cursor, 10) : 0;
      const page = withDistance.slice(startIndex, startIndex + input.limit);
      const nextCursor =
        startIndex + input.limit < withDistance.length
          ? String(startIndex + input.limit)
          : undefined;

      return { venues: page, nextCursor };
    }),

  mapData: protectedProcedure
    .input(
      z.object({
        latitude: z.number(),
        longitude: z.number(),
        radiusKm: z.number().default(5),
      }),
    )
    .query(async ({ input }) => {
      const allVenues = await db.select().from(venue);

      let radiusKm = input.radiusKm;
      let expandedSearch = false;

      // Filter venues within radius
      let withinRadius = allVenues.filter(
        (v) =>
          haversineDistance(input.latitude, input.longitude, v.latitude, v.longitude) <=
          radiusKm,
      );

      // If no venues found, double the radius and try again
      if (withinRadius.length === 0) {
        radiusKm = radiusKm * 2;
        expandedSearch = true;
        withinRadius = allVenues.filter(
          (v) =>
            haversineDistance(input.latitude, input.longitude, v.latitude, v.longitude) <=
            radiusKm,
        );
      }

      const venues = withinRadius.map((v) => ({
        ...v,
        distance: Math.round(
          haversineDistance(input.latitude, input.longitude, v.latitude, v.longitude) * 10,
        ) / 10,
      }));

      return { venues, expandedSearch, radiusKm };
    }),
});
