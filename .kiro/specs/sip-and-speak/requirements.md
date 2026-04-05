# Requirements Document

## Introduction

Sip&Speak is a university-focused mobile application that intelligently matches students for language exchange and organizes real-world meet-ups at local venues. The app enables students to create language profiles, discover compatible language partners nearby, schedule coffee meet-ups at campus-friendly venues, and communicate through contextual chat. The system runs on an existing turborepo monorepo with an Expo/React Native mobile client, a Hono backend server, tRPC API layer, Drizzle ORM with PostgreSQL, and better-auth authentication.

## Glossary

- **Profile_Service**: The backend service responsible for creating, updating, and retrieving user language exchange profiles including spoken languages, learning languages, interests, and university affiliation.
- **Matching_Engine**: The backend service that scores and ranks potential language exchange partners based on language complementarity, shared interests, and geographic proximity.
- **Venue_Service**: The backend service that manages venue data including campus study spots, cafés, and their attributes (Wi-Fi, quiet zones, outdoor seating).
- **MeetUp_Scheduler**: The backend service responsible for proposing, accepting, declining, and managing meet-up appointments between two matched users at a specific venue and time.
- **Chat_Service**: The backend service that handles real-time messaging between matched users, including contextual meet-up information display.
- **Discovery_Screen**: The native mobile screen where users browse and filter potential language exchange partners.
- **Language_Profile**: A data structure containing a user's spoken languages (with proficiency), languages they want to learn, personal interests, bio, and university details.
- **Meet-Up**: A scheduled in-person language exchange session between two users at a specific venue, date, and time.
- **Venue**: A physical location (café, study spot, campus area) where language exchange meet-ups take place, annotated with tags describing its attributes.
- **Conversation_Partner**: Another user with whom the current user has been matched for language exchange.

## Requirements

### Requirement 1: Profile Setup (Learning Lounge)

**User Story:** As a university student, I want to set up my language exchange profile with my spoken languages, learning goals, and personal interests, so that the system can find compatible conversation partners for me.

#### Acceptance Criteria

1. WHEN a newly registered user opens the app for the first time, THE Profile_Service SHALL present a step-by-step onboarding flow that collects spoken languages, learning languages, and personal interests.
2. WHEN the user selects one or more spoken languages, THE Profile_Service SHALL store each language with the user's self-assessed proficiency level.
3. WHEN the user selects one or more languages to learn, THE Profile_Service SHALL store each target language in the user's Language_Profile.
4. WHEN the user selects personal interests from the predefined list (Modern Art, Tech & Coding, Jazz Music, Culinary Arts, Sustainability, Cinephile, Cosmology), THE Profile_Service SHALL associate the selected interests with the user's Language_Profile.
5. WHEN the user taps "Save and Continue", THE Profile_Service SHALL validate that at least one spoken language and at least one learning language are selected before persisting the Language_Profile.
6. IF the user taps "Save and Continue" without selecting at least one spoken language and one learning language, THEN THE Profile_Service SHALL display a validation error indicating the missing selections.
7. WHEN the user taps "Skip for now", THE Profile_Service SHALL save any partially completed selections and allow the user to proceed to the Discovery_Screen.
8. THE Profile_Service SHALL allow the user to edit their Language_Profile at any time from the Profile tab.

### Requirement 2: Partner Discovery and Matching

**User Story:** As a university student, I want to discover and browse compatible language exchange partners near me, so that I can find someone who speaks the language I want to learn and wants to learn a language I speak.

#### Acceptance Criteria

1. WHEN the user navigates to the Discovery_Screen, THE Matching_Engine SHALL retrieve and display a ranked list of Conversation_Partner profiles based on language complementarity, shared interests, and geographic proximity.
2. THE Matching_Engine SHALL score language complementarity by prioritizing partners who speak a language the user wants to learn AND want to learn a language the user speaks fluently.
3. WHEN the user selects a filter tab (Near You, Spanish Experts, or another language-specific filter), THE Matching_Engine SHALL re-rank the displayed profiles according to the selected filter criteria.
4. THE Discovery_Screen SHALL display each Conversation_Partner card with the partner's name, age, distance, spoken languages, learning languages, bio text, and online status.
5. WHEN the user taps "View Profile" on a Conversation_Partner card, THE Discovery_Screen SHALL navigate to a detailed profile view showing the partner's complete Language_Profile and shared interests.
6. WHEN the user taps "Say Hi" on a Conversation_Partner card, THE Chat_Service SHALL create a new conversation thread between the user and the selected Conversation_Partner with an introductory greeting.
7. WHEN the user taps "Schedule a Coffee" on a Conversation_Partner card, THE Discovery_Screen SHALL navigate to the MeetUp_Scheduler screen with the selected Conversation_Partner pre-filled.
8. THE Discovery_Screen SHALL display a "Nearby Study Spots" section showing venues where language exchange students are currently meeting.
9. WHEN the user taps "Explore the Map", THE Discovery_Screen SHALL navigate to a map view showing nearby Venue locations.

### Requirement 3: Venue Management

**User Story:** As a university student, I want to browse campus-friendly venues with relevant attributes, so that I can choose a comfortable spot for my language exchange meet-up.

#### Acceptance Criteria

1. WHEN the user opens the meet-up scheduling flow, THE Venue_Service SHALL display a list of suggested venues sorted by proximity to the user's campus.
2. THE Venue_Service SHALL display each Venue card with a photo, description, and attribute tags (Wi-Fi, Quiet Zone, Campus, Outdoor, Vibrant).
3. WHEN the user taps "View Full Campus Map", THE Venue_Service SHALL display an interactive map showing all available Venue locations with their attribute tags.
4. THE Venue_Service SHALL allow filtering venues by one or more attribute tags.
5. IF no venues are found within the user's campus area, THEN THE Venue_Service SHALL expand the search radius and inform the user of the expanded area.

### Requirement 4: Meet-Up Scheduling

**User Story:** As a university student, I want to propose a meet-up at a specific venue, date, and time with my conversation partner, so that we can practice languages together in person.

#### Acceptance Criteria

1. WHEN the user selects a Venue from the venue list, THE MeetUp_Scheduler SHALL display a calendar date picker for selecting the meet-up date.
2. WHEN the user selects a date, THE MeetUp_Scheduler SHALL display available time slots for that date (e.g., 10:30 AM, 02:15 PM, 04:00 PM, 05:30 PM).
3. WHEN the user selects a time slot and taps "Propose Meeting", THE MeetUp_Scheduler SHALL create a pending Meet-Up record with the selected Venue, date, time, and Conversation_Partner, and send a notification to the Conversation_Partner.
4. WHEN the Conversation_Partner receives a meet-up proposal, THE MeetUp_Scheduler SHALL allow the Conversation_Partner to accept or decline the proposal.
5. WHEN the Conversation_Partner accepts a meet-up proposal, THE MeetUp_Scheduler SHALL update the Meet-Up status to confirmed and notify both users.
6. WHEN the Conversation_Partner declines a meet-up proposal, THE MeetUp_Scheduler SHALL update the Meet-Up status to declined and notify the proposing user.
7. IF the user attempts to propose a Meet-Up that conflicts with an existing confirmed Meet-Up for either participant, THEN THE MeetUp_Scheduler SHALL display a conflict warning and prevent the double-booking.
8. THE MeetUp_Scheduler SHALL display the Conversation_Partner's name and profile photo on the scheduling screen for context.

### Requirement 5: Chat and Messaging

**User Story:** As a university student, I want to chat with my conversation partner with contextual meet-up information visible, so that I can coordinate and prepare for our language exchange session.

#### Acceptance Criteria

1. WHEN the user opens a conversation with a Conversation_Partner, THE Chat_Service SHALL display the message history in chronological order with timestamps on each message.
2. WHILE a confirmed Meet-Up exists between the user and the Conversation_Partner, THE Chat_Service SHALL display an upcoming meet-up card at the top of the chat showing the Venue name, date, time, distance, and shared interests.
3. WHEN the user types a message and taps the send button, THE Chat_Service SHALL deliver the message to the Conversation_Partner and display the message in the sender's chat view with a sent timestamp.
4. WHEN a new message is received from a Conversation_Partner, THE Chat_Service SHALL display the message in the chat view and show a notification badge on the Chats tab if the chat is not currently open.
5. THE Chat_Service SHALL persist all messages so that conversation history is available when the user reopens a chat thread.
6. IF message delivery fails due to a network error, THEN THE Chat_Service SHALL indicate the delivery failure on the affected message and provide a retry option.

### Requirement 6: Bottom Navigation

**User Story:** As a university student, I want consistent bottom navigation across the app, so that I can quickly switch between matching, meet-ups, chats, and my profile.

#### Acceptance Criteria

1. THE app SHALL display a persistent bottom navigation bar with four tabs: MATCH, MEET-UPS, CHATS, and PROFILE.
2. WHEN the user taps a navigation tab, THE app SHALL navigate to the corresponding screen and visually highlight the active tab.
3. WHILE unread messages exist, THE app SHALL display a notification badge on the CHATS tab indicating the count of unread conversations.
4. WHILE pending meet-up proposals exist (incoming or outgoing), THE app SHALL display a notification badge on the MEET-UPS tab.
