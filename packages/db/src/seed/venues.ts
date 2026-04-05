import { db } from "../index";
import { venue } from "../schema";

const sampleVenues = [
  {
    name: "The Study Grind Café",
    description:
      "Cozy campus café with strong espresso and plenty of outlets. A favorite among language exchange pairs for its relaxed vibe.",
    photoUrl: "https://picsum.photos/seed/study-grind/800/600",
    latitude: 40.7295,
    longitude: -73.9965,
    tags: ["wifi", "quiet_zone", "campus"],
  },
  {
    name: "Library Commons",
    description:
      "Open study area on the ground floor of the main library. Group tables and whiteboards available.",
    photoUrl: "https://picsum.photos/seed/library-commons/800/600",
    latitude: 40.7299,
    longitude: -73.9972,
    tags: ["wifi", "quiet_zone", "campus"],
  },
  {
    name: "Campus Green",
    description:
      "Sprawling lawn in the heart of campus. Bring a blanket and practice conversation under the trees.",
    photoUrl: "https://picsum.photos/seed/campus-green/800/600",
    latitude: 40.7302,
    longitude: -73.9952,
    tags: ["outdoor", "campus"],
  },
  {
    name: "The Roast House",
    description:
      "Bustling coffee shop just off campus with great pastries and a lively atmosphere.",
    photoUrl: "https://picsum.photos/seed/roast-house/800/600",
    latitude: 40.7278,
    longitude: -73.9948,
    tags: ["wifi", "vibrant"],
  },
  {
    name: "Quad Courtyard",
    description:
      "Quiet outdoor courtyard surrounded by academic buildings. Benches and shade make it ideal for afternoon chats.",
    photoUrl: "https://picsum.photos/seed/quad-courtyard/800/600",
    latitude: 40.7310,
    longitude: -73.9980,
    tags: ["outdoor", "quiet_zone", "campus"],
  },
];

const moreVenues = [
  {
    name: "International Student Lounge",
    description:
      "Dedicated lounge for international students with comfy seating, a small kitchen, and multilingual book exchange shelf.",
    photoUrl: "https://picsum.photos/seed/intl-lounge/800/600",
    latitude: 40.7288,
    longitude: -73.9990,
    tags: ["wifi", "campus", "quiet_zone"],
  },
  {
    name: "Sunrise Terrace",
    description:
      "Rooftop terrace on the student union building with panoramic views. Open-air seating and a juice bar.",
    photoUrl: "https://picsum.photos/seed/sunrise-terrace/800/600",
    latitude: 40.7315,
    longitude: -73.9958,
    tags: ["outdoor", "vibrant", "campus"],
  },
  {
    name: "Bean & Verse",
    description:
      "Indie bookshop-café hybrid two blocks from campus. Poetry nights on Thursdays and the best matcha in the neighborhood.",
    photoUrl: "https://picsum.photos/seed/bean-verse/800/600",
    latitude: 40.7265,
    longitude: -73.9935,
    tags: ["wifi", "vibrant"],
  },
  {
    name: "The Language Lab",
    description:
      "University-run space with soundproof pods and shared tables designed for language practice sessions.",
    photoUrl: "https://picsum.photos/seed/language-lab/800/600",
    latitude: 40.7305,
    longitude: -73.9945,
    tags: ["wifi", "quiet_zone", "campus"],
  },
  {
    name: "Riverside Benches",
    description:
      "Peaceful benches along the river path, a short walk from campus. Great for casual conversation with a view.",
    photoUrl: "https://picsum.photos/seed/riverside/800/600",
    latitude: 40.7320,
    longitude: -74.0005,
    tags: ["outdoor", "quiet_zone"],
  },
];

const allVenues = [...sampleVenues, ...moreVenues];

async function seed() {
  console.log("🌱 Seeding venues...");

  const existing = await db.select({ id: venue.id }).from(venue).limit(1);

  if (existing.length > 0) {
    console.log("⏭️  Venues already exist, skipping seed.");
    return;
  }

  await db.insert(venue).values(allVenues);

  console.log(`✅ Inserted ${allVenues.length} venues.`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
