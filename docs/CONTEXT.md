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
