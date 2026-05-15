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

### Integration test harness

`packages/api/src/__test-support__/harness.ts`. Boots an in-memory Postgres
via **pg-mem**, applies the production migrations from the drizzle journal,
and replaces `@sip-and-speak/db` with the test DB at import time, so router
code uses it transparently. Helpers: `resetDb()` (restore the
post-migration snapshot), `captureEvents()` (subscribe to `domainEvents`),
`buildSessionContext(userId)` (produce a fake tRPC context).
