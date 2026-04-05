# Implementation Plan: Sip&Speak

## Overview

Incremental implementation of the Sip&Speak language exchange feature across the monorepo: database schema in `packages/db`, tRPC routers in `packages/api`, and Expo/React Native screens in `apps/native`. Each task builds on the previous, starting with data models and backend, then wiring up the mobile UI.

## Tasks

- [x] 1. Define database schema and relations
  - [x] 1.1 Create `packages/db/src/schema/sip-and-speak.ts` with all new tables: `languageProfile`, `userLanguage`, `userInterest`, `venue`, `meetup`, `conversation`, `message`, `messageReadStatus`
    - Use the exact column definitions from the design document
    - All tables reference the existing `user` table from `auth.ts`
    - Include all indexes specified in the design
    - _Requirements: 1.1–1.8, 3.1–3.5, 4.1–4.8, 5.1–5.6_
  - [x] 1.2 Add Drizzle relations for all new tables in the same file
    - Define relations between `languageProfile`, `userLanguage`, `userInterest` and `user`
    - Define relations for `venue` ↔ `meetup`, `conversation` ↔ `message`, `conversation` ↔ `messageReadStatus`
    - Define `meetup` relations to `user` (proposer/receiver) and `venue`
    - _Requirements: 1.1, 2.1, 4.1, 5.1_
  - [x] 1.3 Export the new schema from `packages/db/src/schema/index.ts`
    - Add `export * from "./sip-and-speak"` to the barrel file
    - _Requirements: 1.1_
  - [x] 1.4 Run `drizzle-kit generate` to create the migration, then `drizzle-kit push` to apply it
    - _Requirements: 1.1_

- [x] 2. Checkpoint - Verify database schema
  - Ensure the migration generates cleanly and the schema pushes without errors. Ask the user if questions arise.

- [x] 3. Implement Profile Router
  - [x] 3.1 Create `packages/api/src/routers/profile.ts` with the `profileRouter`
    - Implement `getMyProfile` — query `languageProfile`, `userLanguage`, `userInterest` for the authenticated user
    - Implement `upsertProfile` — validate input (min 1 spoken language, min 1 learning language), upsert `languageProfile`, replace `userLanguage` and `userInterest` rows, set `onboardingComplete` to true
    - Implement `savePartialProfile` — same as upsert but all fields optional, does NOT set `onboardingComplete`
    - Implement `getOnboardingStatus` — return whether the user's `languageProfile.onboardingComplete` is true
    - Input validation with Zod schemas as defined in the design
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_
  - [ ]* 3.2 Write unit tests for profile router
    - Test validation rejects missing spoken/learning languages (Req 1.5, 1.6)
    - Test partial save works without full validation (Req 1.7)
    - Test upsert creates and updates correctly (Req 1.8)
    - _Requirements: 1.5, 1.6, 1.7, 1.8_

- [x] 4. Implement Matching Router
  - [x] 4.1 Create `packages/api/src/routers/matching.ts` with the `matchingRouter`
    - Implement `discover` — query users with language profiles, compute composite score `(languageScore * 0.5) + (interestScore * 0.3) + (proximityScore * 0.2)`, return ranked paginated results
    - Implement language complementarity scoring: 1.0 for full bidirectional match, 0.5 for partial, 0 for none
    - Implement interest scoring: `sharedInterests.length / max(userInterests.length, partnerInterests.length)`
    - Implement proximity scoring: `1 - min(distance / maxRadius, 1)`
    - Support `filter` param for "near_you" (boost proximity weight) and "language" (filter by specific language)
    - Implement `getPartnerProfile` — return full profile with languages, interests, and online status
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ]* 4.2 Write unit tests for matching scoring logic
    - Test full bidirectional language match scores 1.0
    - Test partial match scores 0.5
    - Test interest overlap calculation
    - Test proximity normalization
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 5. Implement Venue Router
  - [x] 5.1 Create `packages/api/src/routers/venue.ts` with the `venueRouter`
    - Implement `list` — query venues sorted by distance from user coordinates, support tag filtering, paginated
    - Implement `mapData` — return all venues within a radius for map display
    - If no venues found within campus area, expand search radius and flag in response
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 6. Implement MeetUp Router
  - [x] 6.1 Create `packages/api/src/routers/meetup.ts` with the `meetupRouter`
    - Implement `propose` — create pending meetup, check for scheduling conflicts with existing confirmed meetups for both participants
    - Implement `respond` — accept or decline a pending meetup, update status, only the receiver can respond
    - Implement `list` — return user's meetups filtered by status, include venue and partner details
    - Implement `getAvailableSlots` — return time slots for a date excluding conflicting confirmed meetups
    - Implement `pendingCount` — return count of pending proposals (incoming + outgoing) for badge
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_
  - [ ]* 6.2 Write unit tests for meetup conflict detection
    - Test proposing a meetup that conflicts with an existing confirmed meetup is rejected (Req 4.7)
    - Test available slots exclude conflicting times
    - _Requirements: 4.7_

- [x] 7. Implement Chat Router
  - [x] 7.1 Create `packages/api/src/routers/chat.ts` with the `chatRouter`
    - Implement `listConversations` — return conversations with last message preview and unread indicator
    - Implement `getMessages` — return paginated messages for a conversation in chronological order
    - Implement `sendMessage` — insert message, update conversation timestamp
    - Implement `startConversation` — create conversation between two users (or return existing), send optional greeting message
    - Implement `unreadCount` — count conversations with messages newer than `lastReadAt`
    - Implement `markRead` — update `messageReadStatus.lastReadAt` for the user in a conversation
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [ ]* 7.2 Write unit tests for chat router
    - Test message ordering is chronological (Req 5.1)
    - Test unread count calculation (Req 5.4)
    - Test startConversation returns existing conversation if one exists (Req 2.6)
    - _Requirements: 5.1, 5.4, 5.5_

- [x] 8. Wire all routers into the app router
  - Register `profileRouter`, `matchingRouter`, `venueRouter`, `meetupRouter`, and `chatRouter` in `packages/api/src/routers/index.ts`
  - Ensure the `AppRouter` type export includes all new routers
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_

- [x] 9. Checkpoint - Verify backend API
  - Ensure all routers compile without type errors. Ask the user if questions arise.

- [x] 10. Restructure native tab layout and add navigation
  - [x] 10.1 Update `apps/native/app/(drawer)/(tabs)/_layout.tsx` to four tabs: MATCH, MEET-UPS, CHATS, PROFILE
    - Replace existing Home/Explore tabs with Match (`index`), Meet-Ups (`meetups`), Chats (`chats`), Profile (`profile`)
    - Use Ionicons: `people-outline`, `calendar-outline`, `chatbubbles-outline`, `person-outline`
    - Add notification badge support on CHATS and MEET-UPS tabs using `unreadCount` and `pendingCount` queries
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [x] 10.2 Create placeholder screen files for new tabs
    - Create `apps/native/app/(drawer)/(tabs)/meetups.tsx`, `chats.tsx`, `profile.tsx`
    - Remove or repurpose `two.tsx`
    - _Requirements: 6.1_

- [x] 11. Implement Profile / Onboarding screens
  - [x] 11.1 Create the onboarding flow screen at `apps/native/app/onboarding.tsx`
    - Step-by-step flow: spoken languages → learning languages → interests → save
    - Call `profile.upsertProfile` on "Save and Continue"
    - Call `profile.savePartialProfile` on "Skip for now"
    - Show validation error if spoken or learning languages are empty on save
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
  - [x] 11.2 Create the profile tab screen at `apps/native/app/(drawer)/(tabs)/profile.tsx`
    - Display current language profile data from `profile.getMyProfile`
    - Provide "Edit Profile" button navigating to edit screen
    - _Requirements: 1.8_
  - [x] 11.3 Create the edit profile screen at `apps/native/app/edit-profile.tsx`
    - Reuse onboarding form components, pre-filled with existing profile data
    - Call `profile.upsertProfile` on save
    - _Requirements: 1.8_
  - [x] 11.4 Add onboarding redirect logic in the drawer layout
    - Check `profile.getOnboardingStatus` on app load; if not complete, redirect to onboarding screen
    - _Requirements: 1.1_

- [x] 12. Implement Discovery (Match) screen
  - [x] 12.1 Create the Match tab screen at `apps/native/app/(drawer)/(tabs)/index.tsx`
    - Fetch ranked partners from `matching.discover`
    - Render partner cards with name, age, distance, languages, bio, online status
    - Add filter tabs (Near You, language-specific filters) that re-fetch with filter params
    - Add "Nearby Study Spots" section using `venue.list`
    - _Requirements: 2.1, 2.3, 2.4, 2.8_
  - [x] 12.2 Create partner detail screen at `apps/native/app/partner/[id].tsx`
    - Fetch full profile from `matching.getPartnerProfile`
    - Display complete language profile and shared interests
    - Include "Say Hi" button calling `chat.startConversation`
    - Include "Schedule a Coffee" button navigating to scheduling flow
    - _Requirements: 2.5, 2.6, 2.7_
  - [x] 12.3 Create map view screen at `apps/native/app/map.tsx`
    - Fetch venue locations from `venue.mapData`
    - Display venues on a map with attribute tag markers
    - Wire "Explore the Map" button from Discovery screen
    - _Requirements: 2.9, 3.3_

- [x] 13. Implement Meet-Up screens
  - [x] 13.1 Create the Meet-Ups tab screen at `apps/native/app/(drawer)/(tabs)/meetups.tsx`
    - Fetch meetups from `meetup.list` with status filter tabs (upcoming, pending, past)
    - Display meetup cards with venue, partner, date/time, status
    - Allow responding to pending proposals (accept/decline) via `meetup.respond`
    - _Requirements: 4.4, 4.5, 4.6_
  - [x] 13.2 Create the scheduling flow screen at `apps/native/app/schedule/[partnerId].tsx`
    - Step 1: Select venue from `venue.list`, show venue cards with photo, description, tags
    - Step 2: Select date via calendar picker
    - Step 3: Select time slot from `meetup.getAvailableSlots`
    - Step 4: Confirm and call `meetup.propose`
    - Display partner name and photo for context
    - Show conflict warning if proposal is rejected due to double-booking
    - _Requirements: 4.1, 4.2, 4.3, 4.7, 4.8, 3.1, 3.2, 3.4_

- [x] 14. Implement Chat screens
  - [x] 14.1 Create the Chats tab screen at `apps/native/app/(drawer)/(tabs)/chats.tsx`
    - Fetch conversations from `chat.listConversations`
    - Display conversation list with partner name, last message preview, unread indicator
    - Navigate to chat conversation on tap
    - _Requirements: 5.1, 5.4_
  - [x] 14.2 Create the chat conversation screen at `apps/native/app/chat/[conversationId].tsx`
    - Fetch messages from `chat.getMessages` with pagination
    - Display messages in chronological order with timestamps
    - Show upcoming meet-up card at top if a confirmed meetup exists (query `meetup.list` filtered to confirmed for this partner)
    - Implement message input with send button calling `chat.sendMessage`
    - Call `chat.markRead` when conversation is opened
    - Show delivery failure indicator and retry option on network error
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 15. Create venue seed script
  - Create `packages/db/src/seed/venues.ts` with sample campus venue data
    - Include a variety of venues with different tags (wifi, quiet_zone, campus, outdoor, vibrant)
    - Include realistic coordinates, names, descriptions, and photo URLs
    - _Requirements: 3.1, 3.2, 3.5_

- [x] 16. Final checkpoint - Full integration verification
  - Ensure all files compile without type errors across the monorepo. Ensure all tests pass. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Chat uses tRPC polling (no WebSocket) per design decision for v1
- Venue data is seed-based for v1 — no user-created venues
