# Domain language — Sip&Speak

The bounded-context map lives in [steering/VISION.md](steering/VISION.md). This file
records names introduced by deepening refactors that aren't yet in VISION.

## Glossary additions

### Meetup aggregate

The pure state machine for the Meetup Scheduling context. Each method takes
a `meetup` row plus the extra rows the transition needs (matched-pair
record, venue, suspension flag, attendance reports) and returns the next
persistent state plus the domain events to emit. Lives at
`packages/api/src/contexts/scheduling/meetup-aggregate.ts`.

Aggregate methods correspond 1:1 to Meetup lifecycle transitions:

- `propose` → `MeetupProposed`
- `confirm` / `decline` (initial response by the receiver)
- `counterPropose` (swap roles, increment round; capped at round 5)
- `cancel` (confirmed → cancelled, before the meetup time)
- `proposeReschedule` / `acceptReschedule` / `declineReschedule`
- `reportAttendance` → `AttendanceReported`, plus
  `SipAndSpeakMomentCompleted` or `MeetupNotAttended` when the union of
  reports decides the outcome.

`MeetupRuleError` is the aggregate's invariant-violation error; the tRPC
router translates it into a `TRPCError` with the matching code.

### OnboardingProgression

Phase derivation for the Identity & Onboarding context. Pure function over
a snapshot of (identity row, language rows, interest count). Phases:

- **Registering** — `user.name` and/or `user.surname` are blank.
- **IdentitySet** — identity is present but the matching-eligibility triple
  (≥1 spoken language, ≥1 learning language, ≥1 interest) is incomplete.
- **Submitted** — matching-eligible. Persisted as
  `languageProfile.onboardingComplete = true`.

`OnboardingProgression.evaluate` returns the phase, identity-completeness,
`matchingEligible`, and a `missingFields` list. `assertCanSubmit` and
`assertNoNativeSpokenLearningConflict` are the two guard helpers.

### Conversation Practice context

New bounded context (Epic #375) owning conversation-starter card content and
the browsing experience. A **buddy** picks a *card language* — narrowed to the
languages already on their profile (spoken or learning) — and flips through a
flat set of basic conversation-starter cards in that language, tapping a card
to reveal its English translation. Intended for use during a **meet-up**.
Read-only dependency on the Identity profile for the language list; no coupling
to the Meetup aggregate in its first iteration.

### Integration test harness

`packages/api/src/__test-support__/harness.ts`. Boots an in-memory Postgres
via **pg-mem**, applies the production migrations from the drizzle journal,
and replaces `@sip-and-speak/db` with the test DB at import time, so router
code uses it transparently. Helpers: `resetDb()` (restore the
post-migration snapshot), `captureEvents()` (subscribe to `domainEvents`),
`buildSessionContext(userId)` (produce a fake tRPC context).

### MatchRequest aggregate

The pure state machine for the Matching context, mirroring the Meetup
aggregate. Lives at
`packages/api/src/contexts/matching/match-request-aggregate.ts`. Each method
takes a loaded snapshot + actor input and returns the next state plus the
domain events to emit. Lifecycle:

- `send` → `MatchRequestSent`
- `accept` → `MatchRequestAccepted`, plus a StudentMatch to create
- `decline` → `MatchRequestDeclined`
- `withdraw` (pending → row hard-deleted; no event)
- `unmatch` (→ `voided`, plus the StudentMatch to drop)

`MatchRuleError` is its invariant-violation error; the tRPC router translates
it into a `TRPCError` with the matching code.

### Unit of work (`commitAndEmit`)

`packages/api/src/unit-of-work.ts`. The single seam where persistence and
event emission happen together: it runs a transition's writes in one
transaction and emits the buffered domain events only after the transaction
commits, so a rolled-back transition emits nothing. Both the Meetup and
Matching routers persist through it. (The transactional rollback of the writes
themselves is a Postgres guarantee; pg-mem does not emulate it — see ADR-0002.)

### Meetup read model

The query side of the Meetup Scheduling context:
`packages/api/src/contexts/scheduling/meetup-read-model.ts`. Owns the
multi-join read queries and view shaping (`listMeetupsForUser`,
`getConfirmedMeetupsForUser`) that the `list` / `getConfirmed` procedures used
to inline. The Meetup aggregate owns the write side; the read model owns the
read side.

### Onboarding wizard gates

Client-side, `apps/native/utils/onboarding-flow.ts`. The onboarding wizard
requires **3–7 interests** (plus ≥1 spoken and ≥1 learning language) to finish
— deliberately STRICTER than the server's matching-eligibility rule (≥1
interest, owned by OnboardingProgression). The server stays the source of truth
for whether a profile is matchable; these gates govern only the wizard UX.

### Matching read model

The query side of the Matching context:
`packages/api/src/contexts/matching/matching-read-model.ts` (`getRankedCandidates`).
Owns partner discovery — the candidate queries, exclusion-list construction,
onboarding/suspension/deleted-account filtering, per-user grouping of languages
and interests, staging into the pure `scoreCandidates` ranker, and cursor
pagination — that the `discover` procedure used to inline. The MatchRequest
aggregate owns the write side; this owns the read side. (Mirrors the Meetup
read model.)

### Conversation read model

The query side of the Conversation context:
`packages/api/src/contexts/conversation/chat-read-model.ts`
(`listConversationsForUser`, `unreadCountForUser`, `listEntriesForUser`). Owns
the inbox multi-table joins and view shaping (partner self-join, `messagingOptIn`
and `attendanceReport` enrichment, locked-phase derivation, per-partner dedupe,
phase-rank sort) the `listConversations` / `unreadCount` / `listEntries`
procedures used to inline. Access control stays in the router and stays split —
the read model contains **zero** access logic (see ADR-0004).

### Messaging unlock rule

`isMutuallyOptedIn(responses)` in
`packages/api/src/contexts/conversation/messaging-utils.ts`. Messaging between
two Students unlocks when BOTH participants of a shared meetup responded to the
opt-in prompt with `accept`; a missing response never unlocks. One predicate,
three callers: `respondToOptIn` (open the conversation, #141),
`startConversation` (authorization guard), and
`getMessagingStateForUserMeetups` (per-meetup state surface). Its sibling
`isOptInDeclineOutcome` names the #142 outcome (both responded, not both
accepted). This names the **unlock** rule only — it is distinct from the
read-vs-send **access** checks, which stay deliberately split per ADR-0004.

### Profile read model

The query side of the Identity context:
`packages/api/src/contexts/identity/profile-read-model.ts` (`getProfileForUser`).
Owns the four-table profile assembly (`languageProfile` + `userLanguage` +
`userInterest` + whitelisted identity fields) the `getMyProfile` procedure used
to inline. The write side — `softDeleteAccount`, `syncMatchingEligibility`,
identity/language/interest mutations — stays in the router; it was already
well-localized.

### Notification dispatch seam

`packages/notifications/src/recipe.ts`. `dispatch` is a thin orchestrator over
two pure transforms and two adapters:

- `toDeliveryMessages(recipes, tokensByRecipient)` — pure; flattens recipes ×
  device tokens into the messages to send.
- `staleTokenIds(tickets, tokenIds)` — pure; selects `DeviceNotRegistered`
  tokens to prune.
- `TokenStore` (`getTokenStore` / `setTokenStore`) — the device-token seam,
  mirroring the `Delivery` seam. `DbTokenStore` defers its `@sip-and-speak/db`
  import to call time, so importing the module does not trigger env validation;
  `InMemoryTokenStore` is the test double. Together with `InMemoryDelivery` this
  lets notification tests run with **no** `mock.module` (resolves the ADR-0002
  mock-leak follow-up).

### Meetup flow view-model

The client meetup flow is split into three layers so each is testable on its own:

1. **Pure rules** — `apps/native/utils/meetup-flow.ts`. Transition/validation/date
   helpers for propose / counter-propose / reschedule
   (`validateProposedScheduledAt`, `validateScheduledAt`, `buildSuggestions`,
   `freeSlotsFor`, `pickProposedScheduledAt`, `isValidTimeFormat`) — no React.
2. **Headless view-models** — `apps/native/hooks/use-meetup-flow.ts`
   (`useProposeFlow`, `useRespondFlow`, `useRescheduleFlow`). Each owns the
   flow's state, tRPC queries, and the mutation cascades — which queries
   invalidate, which `Alert` fires, dismiss-vs-confirm, the decline branch on
   `canCounterPropose`, the counter pre-fill — and returns a small view-model.
   Driven directly with `renderHook`, so the orchestration is tested without
   rendering the modal.
3. **Presentation** — `apps/native/components/meetup-flow-modal.tsx`. Pure JSX
   over the hooks (plus the `GoldButton` / `ErrorBanner` / `VenuePicker`
   sub-components).

Server-driven rules (`canCounterPropose`, round limits, available slots) stay
server-owned; the hooks only orchestrate the client calls and the local
date/slot math. Mirrors `onboarding-flow.ts`.

### Profile presentation module

Client-side, `apps/native/utils/profile-presentation.ts` + the single
`apps/native/components/avatar.tsx`. Owns how a person is *shown*:

- `avatarTone(seed)` / `initials(name)` / `firstInitial(name)` — the
  deterministic pastel tone + initials derivation that was copy-pasted across
  the Matches, Chats, Home, partner-profile and card surfaces.
- `profileSections(profile)` — the Speaks/Learning/Topics view data
  (flag emoji, human label, proficiency detail, stable key) for
  `getPartnerProfile`-shaped data. Interest slugs are mapped to labels here,
  once; screens own only chip styling. Consumed by `partner/[id]`,
  `candidate-card`, and `match-card`.
- `Avatar` — one photo-or-initials circle; per-screen size/palette/testID
  differences are props, not forks.

The web partner page (`apps/web/src/routes/partner/$id.tsx`) shows the same
labels via `apps/web/src/utils/interest-labels.ts` — a deliberate tiny
duplicate of the native lookup, since no runtime package is shared between the
two clients (`@sip-and-speak/api` is only type-imported client-side).

### Chats & Meetups list projections

Pure row → view-data projections, extracted from JSX (mirrors
`components/home/home-state.ts` and the meetup-flow view-model split):

- `apps/native/utils/meetup-card-status.ts` — `meetupCardStatus(row)` turns a
  confirmed-meetup row (`isPast`/`hasReported`/`myAttendance`/
  `reschedulePending`/`rescheduleIsFromMe`) into the card's status pill
  (label + tone) and reschedule affordances (label, disabled,
  partner-proposed flag). Used by the Meetups tab and `hero-confirmed`.
- `apps/native/utils/chat-list.ts` — the `ChatEntry` discriminated union as
  served by `chat.listEntries`, `conversationSubtitle(phase, partnerName)`
  (the six locked-conversation phases → subtitle copy), and
  `chatListCounts(entries)`. Used by the Chats tab and the locked-chat screen.

Both screens are thin JSX over these projections; the branch logic is
unit-tested without rendering.
