/**
 * One-off cleanup: remove the stray venues that the (now-deleted) tue-locations
 * seed could have inserted. Canonical venues come from `seed/venues.ts` (List A).
 *
 * Safe to run repeatedly (idempotent): it only targets the 3 stray names and
 * never touches the 4 canonical venues. A stray venue that is still referenced
 * by a meetup's `venueId` (a RESTRICT foreign key) is left in place and
 * reported, rather than forcing a delete that would break that meetup.
 *
 * Run with:  bun run db:cleanup:stray-venues   (from packages/db)
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "../index";
import { meetup, venue } from "../schema";

/** Names inserted by the old `seed/tue-locations.ts` (removed). */
const STRAY_VENUE_NAMES = [
  "Metaforum Cantine",
  "Atlas Brownies&Downies",
  "Atlas Coffee&Co",
] as const;

async function cleanupStrayVenues() {
  console.log("🧹 Cleaning up stray venues...");

  const strays = await db
    .select({ id: venue.id, name: venue.name })
    .from(venue)
    .where(inArray(venue.name, [...STRAY_VENUE_NAMES]));

  if (strays.length === 0) {
    console.log("✅ No stray venues found — nothing to clean.");
    return;
  }

  const deletable: string[] = [];
  let inUse = 0;

  for (const v of strays) {
    const referencing = await db
      .select({ id: meetup.id })
      .from(meetup)
      .where(eq(meetup.venueId, v.id))
      .limit(1);

    if (referencing.length > 0) {
      console.log(`⏭️  "${v.name}" is still used by a meetup — left in place.`);
      inUse++;
    } else {
      deletable.push(v.id);
    }
  }

  if (deletable.length > 0) {
    await db.delete(venue).where(inArray(venue.id, deletable));
  }

  for (const v of strays) {
    if (deletable.includes(v.id)) console.log(`🗑️  Deleted "${v.name}".`);
  }

  console.log(
    `Done — ${deletable.length} deleted, ${inUse} left in place (still referenced).`,
  );
}

cleanupStrayVenues()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Cleanup failed:", err);
    process.exit(1);
  });
