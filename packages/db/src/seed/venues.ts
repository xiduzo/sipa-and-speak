import { db } from "../index";
import { venue } from "../schema";

const venues = [
  {
    name: "Atlas - Brownies & Downies (TU/e)",
    description: "Inclusive café in the Atlas building run by employees with Down syndrome. Great coffee and a warm atmosphere.",
    photoUrl: "https://picsum.photos/seed/atlas-tue/800/600",
    latitude: 51.4474,
    longitude: 5.4909,
    tags: ["wifi", "campus", "vibrant"],
  },
  {
    name: "Metaforum - Cafeteria (TU/e)",
    description: "Busy cafeteria on the ground floor of Metaforum, central to campus life.",
    photoUrl: "https://picsum.photos/seed/metaforum-tue/800/600",
    latitude: 51.4479,
    longitude: 5.4899,
    tags: ["wifi", "campus"],
  },
  {
    name: "Auditorium - Cafeteria (TU/e)",
    description: "Cafeteria inside the iconic Auditorium building, the heart of TU/e campus.",
    photoUrl: "https://picsum.photos/seed/auditorium-tue/800/600",
    latitude: 51.4481,
    longitude: 5.4892,
    tags: ["wifi", "campus", "quiet_zone"],
  },
  {
    name: "Neuron - Terrace Cafeteria (TU/e)",
    description: "Terrace cafeteria at Neuron with outdoor seating, ideal for a relaxed conversation.",
    photoUrl: "https://picsum.photos/seed/neuron-tue/800/600",
    latitude: 51.4468,
    longitude: 5.4918,
    tags: ["outdoor", "campus", "wifi"],
  },
  {
    name: "Bakkie040 (Blauwe Loper 63a)",
    description: "Neighbourhood coffee bar on Blauwe Loper, a cosy spot for a casual chat over a good cup of coffee.",
    photoUrl: "https://picsum.photos/seed/bakkie040/800/600",
    latitude: 51.4515,
    longitude: 5.479,
    tags: ["wifi", "vibrant"],
  },
  {
    name: "Meteor Community Café (Blauwe Loper 60)",
    description: "Community café on Blauwe Loper with a welcoming atmosphere, perfect for meeting new people.",
    photoUrl: "https://picsum.photos/seed/meteor-cafe/800/600",
    latitude: 51.4514,
    longitude: 5.4792,
    tags: ["wifi", "vibrant", "quiet_zone"],
  },
];

export async function seedVenues() {
  console.log("Seeding venues...");

  const existing = await db.select({ id: venue.id }).from(venue).limit(1);

  if (existing.length > 0) {
    console.log("Venues already exist, skipping.");
    return;
  }

  await db.insert(venue).values(venues);
  console.log(`Inserted ${venues.length} venues.`);
}
