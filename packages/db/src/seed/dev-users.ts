/**
 * Dev seed: test@student.tue.nl + 8 peers with full profiles, matches,
 * meetups (pending / confirmed / completed), conversations, and messages.
 *
 * Run:  bun run src/seed/dev-users.ts
 * Safe: idempotent — skips if test user already exists.
 *
 * Scenario overview
 * ─────────────────
 * ANA      → TEST   pending incoming match request
 * TEST     → PIERRE pending outgoing match request
 * TEST+CARLOS       matched (studentMatch) — meetup proposed by TEST (pending)
 * TEST+YUKI         matched → completed meetup → both opt-in → open conversation (5 msgs)
 * TEST+FATIMA       matched → completed meetup → only TEST opted in (FATIMA pending)
 * TEST+MARCO        matched → confirmed upcoming meetup
 * LISA              no request → appears in suggestions
 * JIN               no request → appears in suggestions
 */

import { db } from "../index";
import {
  languageProfile,
  userLanguage,
  userInterest,
  venue,
  meetup,
  matchRequest,
  studentMatch,
  attendanceReport,
  messagingOptIn,
  conversation,
  message,
} from "../schema/sip-and-speak";
import { user } from "../schema/auth";
import { eq } from "drizzle-orm";

// ─── Deterministic IDs ────────────────────────────────────────────────────────

const IDS = {
  // users
  TEST:   "seed-test-student-01",
  ANA:    "seed-peer-ana-01",
  PIERRE: "seed-peer-pierre-01",
  CARLOS: "seed-peer-carlos-01",
  YUKI:   "seed-peer-yuki-01",
  FATIMA: "seed-peer-fatima-01",
  MARCO:  "seed-peer-marco-01",
  LISA:   "seed-peer-lisa-01",
  JIN:    "seed-peer-jin-01",

  // venues (seed-specific names to avoid collision with the venues seed)
  VENUE_CAFE:    "seed-venue-cafe-01",
  VENUE_LIBRARY: "seed-venue-library-01",

  // match requests
  MR_ANA_TO_TEST:    "seed-mr-ana-test-01",
  MR_TEST_TO_PIERRE: "seed-mr-test-pierre-01",
  MR_TEST_TO_CARLOS: "seed-mr-test-carlos-01",
  MR_TEST_TO_YUKI:   "seed-mr-test-yuki-01",
  MR_TEST_TO_FATIMA: "seed-mr-test-fatima-01",
  MR_TEST_TO_MARCO:  "seed-mr-test-marco-01",

  // student matches
  SM_TEST_CARLOS: "seed-sm-test-carlos-01",
  SM_TEST_YUKI:   "seed-sm-test-yuki-01",
  SM_TEST_FATIMA: "seed-sm-test-fatima-01",
  SM_TEST_MARCO:  "seed-sm-test-marco-01",

  // meetups
  MEETUP_TEST_CARLOS:  "seed-meetup-test-carlos-01",
  MEETUP_TEST_YUKI:    "seed-meetup-test-yuki-01",
  MEETUP_TEST_FATIMA:  "seed-meetup-test-fatima-01",
  MEETUP_TEST_MARCO:   "seed-meetup-test-marco-01",

  // conversations
  CONV_TEST_YUKI: "seed-conv-test-yuki-01",
} as const;

// TU/e Eindhoven campus area (lat/lng jitter keeps distance-score interesting)
const LOC = {
  TEST:   { latitude: 51.4484, longitude: 5.4909 },
  ANA:    { latitude: 51.4490, longitude: 5.4915 },
  PIERRE: { latitude: 51.4478, longitude: 5.4920 },
  CARLOS: { latitude: 51.4495, longitude: 5.4905 },
  YUKI:   { latitude: 51.4480, longitude: 5.4930 },
  FATIMA: { latitude: 51.4470, longitude: 5.4900 },
  MARCO:  { latitude: 51.4500, longitude: 5.4895 },
  LISA:   { latitude: 51.4488, longitude: 5.4940 },
  JIN:    { latitude: 51.4475, longitude: 5.4885 },
};

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Seeding dev users...");

  // Resolve the real test-user ID — may differ from IDS.TEST if auth created the account first
  const existingTest = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, "test@student.tue.nl"))
    .limit(1);

  const TEST_ID = existingTest[0]?.id ?? IDS.TEST;

  // ── 1. Venues (seed-local, won't collide with venue seed) ──────────────────
  await db.insert(venue).values([
    {
      id: IDS.VENUE_CAFE,
      name: "[Dev] The Study Grind Café",
      description: "Cozy campus café. Seed data only.",
      photoUrl: "https://picsum.photos/seed/study-grind/800/600",
      latitude: 51.4486,
      longitude: 5.4912,
      tags: ["wifi", "quiet_zone", "campus"],
    },
    {
      id: IDS.VENUE_LIBRARY,
      name: "[Dev] Library Commons",
      description: "Open study area. Seed data only.",
      photoUrl: "https://picsum.photos/seed/library-commons/800/600",
      latitude: 51.4482,
      longitude: 5.4918,
      tags: ["wifi", "quiet_zone", "campus"],
    },
  ]).onConflictDoNothing();

  const venueA = IDS.VENUE_CAFE;
  const venueB = IDS.VENUE_LIBRARY;

  // ── 2. Users ───────────────────────────────────────────────────────────────
  // Insert test user only if not already in DB (auth may have created it with a different ID)
  if (!existingTest[0]) {
    await db.insert(user).values({ id: TEST_ID, name: "Test Student", email: "test@student.tue.nl", emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
  }
  await db.insert(user).values([
    { id: IDS.ANA,    name: "Ana García",    email: "ana@student.tue.nl",    emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    { id: IDS.PIERRE, name: "Pierre Dupont", email: "pierre@student.tue.nl", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    { id: IDS.CARLOS, name: "Carlos Mendez", email: "carlos@student.tue.nl", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    { id: IDS.YUKI,   name: "Yuki Tanaka",   email: "yuki@student.tue.nl",   emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    { id: IDS.FATIMA, name: "Fatima Al-Hassan", email: "fatima@student.tue.nl", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    { id: IDS.MARCO,  name: "Marco Rossi",   email: "marco@student.tue.nl",  emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    { id: IDS.LISA,   name: "Lisa Müller",   email: "lisa@student.tue.nl",   emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    { id: IDS.JIN,    name: "Jin Park",      email: "jin@student.tue.nl",    emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
  ]).onConflictDoNothing();

  // ── 3. Language profiles ───────────────────────────────────────────────────
  await db.insert(languageProfile).values([
    { userId: TEST_ID,    bio: "CS master's student — cosmology nerd + open source enthusiast. Trying to pick up Spanish & French!", university: "TU/e", age: 24, ...LOC.TEST,   onboardingComplete: true },
    { userId: IDS.ANA,    bio: "Exchange student from Madrid. Love jazz and cooking. Will help you with Spanish!", university: "TU/e", age: 22, ...LOC.ANA,    onboardingComplete: true },
    { userId: IDS.PIERRE, bio: "Art historian from Lyon. Huge film buff — always looking for an English conversation partner.", university: "TU/e", age: 23, ...LOC.PIERRE, onboardingComplete: true },
    { userId: IDS.CARLOS, bio: "Sustainability engineer from Mexico. Keen to experience Dutch culture while teaching Spanish.", university: "TU/e", age: 25, ...LOC.CARLOS, onboardingComplete: true },
    { userId: IDS.YUKI,   bio: "Data science student from Tokyo. Learning Dutch and loving Eindhoven life!", university: "TU/e", age: 22, ...LOC.YUKI,   onboardingComplete: true },
    { userId: IDS.FATIMA, bio: "Biomedical engineer from Cairo. French speaker looking for Dutch & English practice.", university: "TU/e", age: 26, ...LOC.FATIMA, onboardingComplete: true },
    { userId: IDS.MARCO,  bio: "Architecture student from Milan. Learning English through design conversations.", university: "TU/e", age: 24, ...LOC.MARCO,  onboardingComplete: true },
    { userId: IDS.LISA,   bio: "Psychology researcher from Berlin. Fluent in German & English, learning Spanish for fun.", university: "TU/e", age: 27, ...LOC.LISA,   onboardingComplete: true },
    { userId: IDS.JIN,    bio: "Electrical engineering PhD from Seoul. Learning Dutch & English to integrate better.", university: "TU/e", age: 28, ...LOC.JIN,    onboardingComplete: true },
  ]).onConflictDoNothing();

  // ── 4. Languages ──────────────────────────────────────────────────────────
  await db.insert(userLanguage).values([
    // TEST: speaks Dutch + English, learning Spanish + French
    { userId: TEST_ID,    language: "Dutch",    type: "spoken",   proficiency: "native" },
    { userId: TEST_ID,    language: "English",  type: "spoken",   proficiency: "advanced" },
    { userId: TEST_ID,    language: "Spanish",  type: "learning", proficiency: "beginner" },
    { userId: TEST_ID,    language: "French",   type: "learning", proficiency: "beginner" },
    // ANA: Spanish native, learning Dutch
    { userId: IDS.ANA,    language: "Spanish",  type: "spoken",   proficiency: "native" },
    { userId: IDS.ANA,    language: "Dutch",    type: "learning", proficiency: "beginner" },
    // PIERRE: French native, learning English
    { userId: IDS.PIERRE, language: "French",   type: "spoken",   proficiency: "native" },
    { userId: IDS.PIERRE, language: "English",  type: "learning", proficiency: "intermediate" },
    // CARLOS: Spanish + English speaker, learning Dutch
    { userId: IDS.CARLOS, language: "Spanish",  type: "spoken",   proficiency: "native" },
    { userId: IDS.CARLOS, language: "English",  type: "spoken",   proficiency: "advanced" },
    { userId: IDS.CARLOS, language: "Dutch",    type: "learning", proficiency: "beginner" },
    // YUKI: Japanese + English speaker, learning Dutch
    { userId: IDS.YUKI,   language: "Japanese", type: "spoken",   proficiency: "native" },
    { userId: IDS.YUKI,   language: "English",  type: "spoken",   proficiency: "advanced" },
    { userId: IDS.YUKI,   language: "Dutch",    type: "learning", proficiency: "beginner" },
    // FATIMA: Arabic + French speaker, learning Dutch + English
    { userId: IDS.FATIMA, language: "Arabic",   type: "spoken",   proficiency: "native" },
    { userId: IDS.FATIMA, language: "French",   type: "spoken",   proficiency: "advanced" },
    { userId: IDS.FATIMA, language: "Dutch",    type: "learning", proficiency: "beginner" },
    { userId: IDS.FATIMA, language: "English",  type: "learning", proficiency: "intermediate" },
    // MARCO: Italian native, learning English
    { userId: IDS.MARCO,  language: "Italian",  type: "spoken",   proficiency: "native" },
    { userId: IDS.MARCO,  language: "English",  type: "learning", proficiency: "intermediate" },
    // LISA: German + English speaker, learning Spanish
    { userId: IDS.LISA,   language: "German",   type: "spoken",   proficiency: "native" },
    { userId: IDS.LISA,   language: "English",  type: "spoken",   proficiency: "advanced" },
    { userId: IDS.LISA,   language: "Spanish",  type: "learning", proficiency: "intermediate" },
    // JIN: Korean + English speaker, learning Dutch
    { userId: IDS.JIN,    language: "Korean",   type: "spoken",   proficiency: "native" },
    { userId: IDS.JIN,    language: "English",  type: "spoken",   proficiency: "intermediate" },
    { userId: IDS.JIN,    language: "Dutch",    type: "learning", proficiency: "beginner" },
  ]).onConflictDoNothing();

  // ── 5. Interests ──────────────────────────────────────────────────────────
  await db.insert(userInterest).values([
    { userId: TEST_ID,    interest: "tech_coding" },
    { userId: TEST_ID,    interest: "cosmology" },
    { userId: IDS.ANA,    interest: "jazz_music" },
    { userId: IDS.ANA,    interest: "culinary_arts" },
    { userId: IDS.PIERRE, interest: "modern_art" },
    { userId: IDS.PIERRE, interest: "cinephile" },
    { userId: IDS.CARLOS, interest: "sustainability" },
    { userId: IDS.CARLOS, interest: "tech_coding" },
    { userId: IDS.YUKI,   interest: "tech_coding" },
    { userId: IDS.YUKI,   interest: "cosmology" },
    { userId: IDS.FATIMA, interest: "sustainability" },
    { userId: IDS.FATIMA, interest: "modern_art" },
    { userId: IDS.MARCO,  interest: "modern_art" },
    { userId: IDS.MARCO,  interest: "culinary_arts" },
    { userId: IDS.LISA,   interest: "jazz_music" },
    { userId: IDS.LISA,   interest: "tech_coding" },
    { userId: IDS.JIN,    interest: "tech_coding" },
    { userId: IDS.JIN,    interest: "cosmology" },
  ]).onConflictDoNothing();

  // ── 6. Match requests ─────────────────────────────────────────────────────
  await db.insert(matchRequest).values([
    { id: IDS.MR_ANA_TO_TEST,    requesterId: IDS.ANA,    receiverId: TEST_ID,   status: "pending",  createdAt: new Date("2026-04-10"), updatedAt: new Date("2026-04-10") },
    { id: IDS.MR_TEST_TO_PIERRE, requesterId: TEST_ID,    receiverId: IDS.PIERRE, status: "pending",  createdAt: new Date("2026-04-11"), updatedAt: new Date("2026-04-11") },
    { id: IDS.MR_TEST_TO_CARLOS, requesterId: TEST_ID,    receiverId: IDS.CARLOS, status: "accepted", createdAt: new Date("2026-04-01"), updatedAt: new Date("2026-04-02") },
    { id: IDS.MR_TEST_TO_YUKI,   requesterId: TEST_ID,    receiverId: IDS.YUKI,   status: "accepted", createdAt: new Date("2026-03-01"), updatedAt: new Date("2026-03-02") },
    { id: IDS.MR_TEST_TO_FATIMA, requesterId: IDS.FATIMA, receiverId: TEST_ID,    status: "accepted", createdAt: new Date("2026-03-10"), updatedAt: new Date("2026-03-11") },
    { id: IDS.MR_TEST_TO_MARCO,  requesterId: TEST_ID,    receiverId: IDS.MARCO,  status: "accepted", createdAt: new Date("2026-04-05"), updatedAt: new Date("2026-04-06") },
  ]).onConflictDoNothing();

  // ── 7. Student matches ────────────────────────────────────────────────────
  await db.insert(studentMatch).values([
    { id: IDS.SM_TEST_CARLOS, studentAId: TEST_ID,    studentBId: IDS.CARLOS, matchRequestId: IDS.MR_TEST_TO_CARLOS, status: "matched",   createdAt: new Date("2026-04-02") },
    { id: IDS.SM_TEST_YUKI,   studentAId: TEST_ID,    studentBId: IDS.YUKI,   matchRequestId: IDS.MR_TEST_TO_YUKI,   status: "connected", createdAt: new Date("2026-03-02") },
    { id: IDS.SM_TEST_FATIMA, studentAId: IDS.FATIMA, studentBId: TEST_ID,    matchRequestId: IDS.MR_TEST_TO_FATIMA, status: "matched",   createdAt: new Date("2026-03-11") },
    { id: IDS.SM_TEST_MARCO,  studentAId: TEST_ID,    studentBId: IDS.MARCO,  matchRequestId: IDS.MR_TEST_TO_MARCO,  status: "matched",   createdAt: new Date("2026-04-06") },
  ]).onConflictDoNothing();

  // ── 8. Meetups ────────────────────────────────────────────────────────────
  await db.insert(meetup).values([
    { id: IDS.MEETUP_TEST_CARLOS, proposerId: TEST_ID,    receiverId: IDS.CARLOS, venueId: venueA, date: "2026-04-22", time: "14:00", status: "pending",   round: 1, createdAt: new Date("2026-04-13"), updatedAt: new Date("2026-04-13") },
    { id: IDS.MEETUP_TEST_YUKI,   proposerId: TEST_ID,    receiverId: IDS.YUKI,   venueId: venueB, date: "2026-03-15", time: "10:30", status: "completed", round: 1, createdAt: new Date("2026-03-10"), updatedAt: new Date("2026-03-15") },
    { id: IDS.MEETUP_TEST_FATIMA, proposerId: IDS.FATIMA, receiverId: TEST_ID,    venueId: venueA, date: "2026-03-28", time: "15:30", status: "completed", round: 2, createdAt: new Date("2026-03-20"), updatedAt: new Date("2026-03-28") },
    { id: IDS.MEETUP_TEST_MARCO,  proposerId: IDS.MARCO,  receiverId: TEST_ID,    venueId: venueA, date: "2026-04-20", time: "13:00", status: "confirmed", round: 1, createdAt: new Date("2026-04-07"), updatedAt: new Date("2026-04-08") },
  ]).onConflictDoNothing();

  // ── 9. Attendance reports ─────────────────────────────────────────────────
  await db.insert(attendanceReport).values([
    { meetupId: IDS.MEETUP_TEST_YUKI,   studentId: TEST_ID,    attended: true, reportedAt: new Date("2026-03-15T12:00:00Z") },
    { meetupId: IDS.MEETUP_TEST_YUKI,   studentId: IDS.YUKI,   attended: true, reportedAt: new Date("2026-03-15T12:30:00Z") },
    { meetupId: IDS.MEETUP_TEST_FATIMA, studentId: TEST_ID,    attended: true, reportedAt: new Date("2026-03-28T17:00:00Z") },
    { meetupId: IDS.MEETUP_TEST_FATIMA, studentId: IDS.FATIMA, attended: true, reportedAt: new Date("2026-03-28T17:15:00Z") },
  ]).onConflictDoNothing();

  // ── 10. Messaging opt-ins ─────────────────────────────────────────────────
  await db.insert(messagingOptIn).values([
    { meetupId: IDS.MEETUP_TEST_YUKI,   studentId: TEST_ID,  response: "accept", respondedAt: new Date("2026-03-15T13:00:00Z") },
    { meetupId: IDS.MEETUP_TEST_YUKI,   studentId: IDS.YUKI, response: "accept", respondedAt: new Date("2026-03-15T13:10:00Z") },
    { meetupId: IDS.MEETUP_TEST_FATIMA, studentId: TEST_ID,  response: "accept", respondedAt: new Date("2026-03-28T17:30:00Z") },
  ]).onConflictDoNothing();

  // ── 11. Conversation + messages (TEST ↔ YUKI) ────────────────────────────
  await db.insert(conversation).values({
    id: IDS.CONV_TEST_YUKI,
    user1Id: TEST_ID,
    user2Id: IDS.YUKI,
    meetupId: IDS.MEETUP_TEST_YUKI,
    status: "open",
    createdAt: new Date("2026-03-15T13:15:00Z"),
  }).onConflictDoNothing();

  const t = (offsetMinutes: number) =>
    new Date(new Date("2026-03-15T13:20:00Z").getTime() + offsetMinutes * 60_000);

  await db.insert(message).values([
    { conversationId: IDS.CONV_TEST_YUKI, senderId: TEST_ID,   content: "Hey Yuki! Great meeting you at the library today 😊", createdAt: t(0) },
    { conversationId: IDS.CONV_TEST_YUKI, senderId: IDS.YUKI,  content: "Same! Your Spanish is already better than you think haha. Let's keep practising!", createdAt: t(5) },
    { conversationId: IDS.CONV_TEST_YUKI, senderId: TEST_ID,   content: "Ha thanks! You really helped me with those verb conjugations. How's your Dutch coming along?", createdAt: t(12) },
    { conversationId: IDS.CONV_TEST_YUKI, senderId: IDS.YUKI,  content: "Slowly 😅 'gezellig' is my favourite word so far. Want to meet again next week?", createdAt: t(20) },
    { conversationId: IDS.CONV_TEST_YUKI, senderId: TEST_ID,   content: "Definitely! Same spot? I'll bring my vocab cards this time.", createdAt: t(35) },
    { conversationId: IDS.CONV_TEST_YUKI, senderId: IDS.YUKI,  content: "Perfect, see you then! 🙌", createdAt: t(40) },
  ]);

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log("✅ Dev seed complete.\n");
  console.log("Users:");
  console.log(`  test@student.tue.nl    — the test account (id: ${TEST_ID})`);
  console.log("  ana@student.tue.nl     — pending incoming match request");
  console.log("  pierre@student.tue.nl  — pending outgoing match request (sent by test)");
  console.log("  carlos@student.tue.nl  — matched; meetup proposal pending");
  console.log("  yuki@student.tue.nl    — matched; completed meetup; open conversation");
  console.log("  fatima@student.tue.nl  — matched; completed meetup; only test opted in");
  console.log("  marco@student.tue.nl   — matched; confirmed upcoming meetup");
  console.log("  lisa@student.tue.nl    — no request; appears in suggestions");
  console.log("  jin@student.tue.nl     — no request; appears in suggestions");
  console.log("");
  console.log("Flag-user test paths:");
  console.log("  Suggestions       → Lisa / Jin → Report Student");
  console.log("  Incoming requests → Ana  → Report Student");
  console.log("  Partner profile   → any matched peer → Report Student");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Dev seed failed:", err);
    process.exit(1);
  });
