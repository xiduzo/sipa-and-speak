# Sip&Speak — Application Specification

## Overview

Sip&Speak (S&S) is a mobile language-exchange platform for students at Eindhoven University of Technology (TU/e). It matches Dutch and international students based on language proficiency and personality, then arranges in-person meet-ups ("S&S moments") at local retailers. The goal is to facilitate real-life language practice while building community between local and international students.

---

## User Types

Users progress through relationship stages. The active stage determines which features are available.

| User class | Description |
|---|---|
| **Registering** | Downloaded the app, signing up and creating a profile |
| **Registered** | Completed sign-up but not yet started matching (idle) |
| **Matching** | Actively looking for a match; either requesting (sends request) or receiving (accepts/denies) |
| **Matched** | Both users accepted the match request; not yet connected |
| **Connecting** | Matched users scheduling a physical S&S moment (filling LettuceMeet, picking location) |
| **Connected** | Completed their first physical S&S moment |
| **Repetitive** | Wants to meet the same connected user again, or continue via messaging |
| **Disruptive** | Should not use S&S (socially malicious, liars, inappropriate use); can be removed by Admin |
| **Admin** | S&S team member; reviews flagged users and removes them if necessary |
| **Retailer** (indirect) | Receives monthly usage/user reports from S&S |
| **TU/e** (indirect) | Receives monthly usage/user reports from S&S |

---

## Core User Flows

### 1. Sign-up (UCU-1)
1. User enters their `@student.tue.nl` email address.
2. S&S sends a verification email; user clicks "Verify".
3. User is directed to create and confirm a password.
4. TU/e email domain enforces the TU/e-only scope.

### 2. Create Profile (UCU-2)
Fields collected:
- **Personal details**: first name, last name, age, study program, profile picture (JPG)
- **Biography**: introduction (250 chars), hobby (80 chars), conversation topics (250 chars)
- **Languages**:
  - *Offered languages*: languages spoken fluently + proficiency level (A1–C2)
  - *Targeted languages*: languages to improve + current level (A1–C2)

Profile cannot be edited after saving (v1.0 limitation). User becomes a "registered user" once saved.

### 3. Find a Match (UCU-4)
1. Requesting user taps **"Find Suggestions"**.
2. S&S returns a suggestion list: profiles where the other user's offered language matches the requester's targeted language (and vice versa).
3. User browses profiles (biography/personality focus) and taps **"Send Request"** on an interesting profile.
4. Receiving user gets a **match request** notification; they can **Accept** or **Deny**.
5. On acceptance, both users are notified and become "matched".

### 4. Accept Connection (UCU-6)
Both matched users tap **"Connect Now"** on the match acceptance notification or each other's profile. They become "connecting users".

### 5. Find Overlapping Time Slots (UCU-7)
1. S&S sends both connecting users a **LettuceMeet** link (7-day calendar, 8:00–22:00, starting the day after "Connect Now").
2. Both users fill in their availability within **24 hours**.
3. LettuceMeet returns overlapping time slots to S&S.
4. If no overlap or either user fails to respond → connection is lost; users must click "Connect Now" again.

> Time slots must be at least 30 minutes long.

### 6. Find S&S Moment Location (UCU-8)
1. S&S sends both connecting users an **availability list** with the overlapping time slots.
2. For each slot, users confirm availability and select a **location preference**: On-campus, Off-campus, or both.
3. Users confirm within **24 hours** (else connection is lost).
4. S&S picks the most favorable time + location (preference matching, then earliest on-campus fallback).
5. S&S makes a **reservation** in the retailer's online reservation system.
6. Both users receive a **"Successful Meet-up"** notification with date, time, and retailer location.

### 7. Communicate Deviations (UCU-9)
If a connecting user is running late or cannot attend, they can send a **predetermined message** to their partner:
- "I am running late 5 min"
- "I am running late 10 min"
- "I am running late 15 min"
- "I need to cancel due to transport issues"
- "I got sick sorry"
- "I won't make it I am very sorry"

### 8. Post-Meet-up: Feedback (UCU-10 & UCU-11)
After the physical S&S moment, connected users can:
- **Leave a comment** on the other user's profile (max 250 chars).
- **Flag the profile** for major violations (requires a written explanation, max 450 chars).

Flag categories: disrespectful against different cultures, sexist behavior, inappropriate app usage (e.g., dating), refusal to practice language skills, refusal to pay, other inappropriate behavior.

> A user flagged **3 times by 3 different users** is automatically queued for admin removal.

### 9. Messaging (UCU-12)
Available only **after the first physical S&S moment**. Repetitive users can open-chat with acquainted connected users (max 450 chars per message).

### 10. Admin: Remove Users (UCA-1)
1. Admin receives a flagging alert.
2. Admin reviews flagging explanations and profile comments.
3. Admin decides to delete the profile or dismiss the flag.
4. Deletion completes in ≤5 seconds.

---

## Business Rules

| ID | Rule |
|---|---|
| BR-1 | Only TU/e students (`@student.tue.nl`) can register |
| BR-2 | Registration must be complete before matching |
| BR-3 | LettuceMeet time slots must be ≥30 minutes |
| BR-4 | Users must enter availability in LettuceMeet within 24 hours of "Connect Now" |
| BR-5 | If "pick timeslot" fails, connection is lost; users must click "Connect Now" again |
| BR-6 | If no location match found, S&S defaults to on-campus, earliest timeslot |
| BR-7 | Users must enter location preference within 24 hours of receiving availability list |
| BR-8 | If "pick location area" fails, connection is lost |
| BR-9 | Users can only comment/flag acquainted connected users |
| BR-10 | Messaging is only available after the first physical S&S moment |
| BR-11 | Only a verified S&S team member can be Admin |

---

## Data Model (Key Entities)

### Signee
- Signee ID, TU/e email (`@student.tue.nl`), password, registration date

### Profile
- Profile ID, profile picture (JPG), username (first + last name), first name, last name, age, study
- Biography: introduction, hobby, conversation topics
- Offered languages (language + proficiency A1–C2)
- Targeted languages (language + proficiency A1–C2)

### Suggestion List
- Up to 10 "alike profiles" (mutual language match)

### Match Request
- Match request ID, requesting user, receiving user, date

### Messages
- Chat message (max 450 chars) — open chat, post-meet-up only
- Predetermined message (6 fixed options) — deviation communication

### Feedback
- Comment (max 250 chars) + date
- Flag explanation (max 450 chars) + date

### Reservation
- Reservation ID, selected time slot, retailer (on-campus or off-campus), location details

### Notifications
**Matching process:** suggestion failure, match request, match acceptance, match denial

**Connecting process:** LettuceMeet availability, successful/unsuccessful availability match, successful/unsuccessful meet-up match

**Feedback:** comment/date (for repetitive users)

---

## External Integrations

| System | Role |
|---|---|
| **LettuceMeet** | Scheduling tool; collects user availability, returns overlapping time slots |
| **Retailer reservation system** | S&S makes table reservations on behalf of users |
| **Outlook** | Email verification during sign-up; sends verification link |
| **AWS** | Cloud platform (servers, databases, storage) |
| **App Store / Google Play** | App distribution |

---

## Screens / UI

| Screen | Key elements |
|---|---|
| **Sign-up p1** (UI-1) | Email field, Verify button |
| **Waiting for verification** (UI-1.1) | Static message |
| **Sign-up p2** (UI-1.2) | Password, re-password, Continue |
| **Create profile** (UI-1.3) | Photo picker, name, languages + proficiency, age, study, bio fields, Save |
| **Home page** (UI-2) | Lists of matched/connecting/connected users; Settings, Find Suggestions, Notifications, My Profile |
| **Language settings** (UI-2.1) | English / Dutch toggle, Save |
| **Suggestion list** (UI-2.2) | Scrollable profile cards → tap to open full profile |
| **Notifications** (UI-2.3) | All notification types with context-specific action buttons |
| **Profile view** (UI-3) | Photo, username, bio, languages; action buttons vary by status: Send Request → Accept/Deny Match → Connect Now → LettuceMeet → Meet-up Preference → Message → Feedback |
| **Chat** (UI-3.1) | Message history, text input (post-meet-up), predetermined message picker (pre-meet-up), Send |
| **Feedback** (UI-3.2) | Comment text box, Flag text box, Save |
| **Meet-up location preference** (UI-4) | Overlapping time slot list; on-campus/off-campus per slot; Save |

---

## Quality Requirements

### Usability
- 95% of new users complete their profile within 20 minutes
- Core actions (pick time slot, location, communicate delay, comment, flag, message) learnable in ≤5 minutes with no orientation
- Follows Nielsen's 10 usability heuristics
- Admin can remove a flagged user within 5 minutes

### Performance
- Verification email sent within 1 minute of sign-up
- Notifications displayed within 3 seconds
- Chat messages sent within 3 seconds
- Account deletion completes within 5 seconds
- 90% of connecting users get a scheduled S&S moment within 3 weeks of registration
- Supports up to 100 concurrent users without degradation

### Security
- 256-bit encryption for: passwords, emails, suggestion lists, notifications, availability lists, locations/times, retailer lists
- Account locked after 3 failed login attempts within 10 minutes
- Only admins can access flagged-user information
- Complies with GDPR and ISO/IEC 27001

### Safety
- Messaging only available to connected users (post-meet-up)
- Email domain verified to enforce TU/e scope
- User auto-queued for removal after 3 flags from 3 different users

### Availability
- ≥99% uptime 6:00–01:00 CET
- ≥90% uptime 01:00–06:00 CET

---

## Data Retention & Privacy

- Inactive profiles deleted after **1 year**
- Profile data, connections, and messages retained for **2 years** after last interaction
- On account deletion or user request: all data disposed within **60 days**
- All user-generated content maintained with integrity per GDPR (AVG)

---

## Localization

- Supported languages: **English** and **Dutch**
- All UI text translated (excluding user-input fields like comments)
- Timestamps adjusted to user's mobile timezone
- S&S moment scheduling in Central European Time
- Date format: `DD/MM/YYYY`, Time format: `HH:MM`

---

## Out of Scope (v1.0)

- Profile editing after creation
- Languages other than Dutch/English in app settings
- Blacklist for removed users
- Structured/validated input fields for profile details
- Direct user search bar
- Ice-breaking questions
- Outlook calendar sync for S&S moments
