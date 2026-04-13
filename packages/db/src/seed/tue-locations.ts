import { eq } from "drizzle-orm";
import { db } from "../index";
import { venue } from "../schema";

const tueCampusLocations = [
  {
    name: "Metaforum Cantine",
    description:
      "The main cantine in TU/e's Metaforum building — spacious, central, and always busy. Great for a relaxed Sip&Speak over lunch.",
    latitude: 51.4478,
    longitude: 5.4873,
    tags: ["campus", "vibrant"] as string[],
    isActive: true,
  },
  {
    name: "Atlas Brownies&Downies",
    description:
      "An inclusive café on the ground floor of the Atlas building, run by people with and without Down's syndrome. Warm atmosphere, excellent brownies.",
    latitude: 51.4492,
    longitude: 5.4848,
    tags: ["campus", "quiet_zone"] as string[],
    isActive: true,
  },
  {
    name: "Atlas Coffee&Co",
    description:
      "The coffee corner inside Atlas — quick service and a cosy seating area, perfect for a short Sip&Speak session between classes.",
    latitude: 51.449,
    longitude: 5.485,
    tags: ["campus", "wifi"] as string[],
    isActive: true,
  },
];

async function seed() {
  console.log("🌱 Seeding TU/e on-campus locations...");

  let inserted = 0;
  let skipped = 0;

  for (const location of tueCampusLocations) {
    const existing = await db
      .select({ id: venue.id })
      .from(venue)
      .where(eq(venue.name, location.name))
      .limit(1);

    if (existing.length > 0) {
      console.log(`⏭️  "${location.name}" already exists, skipping.`);
      skipped++;
    } else {
      await db.insert(venue).values(location);
      console.log(`✅ Inserted "${location.name}".`);
      inserted++;
    }
  }

  console.log(
    `Done — ${inserted} inserted, ${skipped} skipped (idempotent).`,
  );
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
