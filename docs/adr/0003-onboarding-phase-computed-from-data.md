# ADR 0003 — Onboarding phase computed from data, not stored as a column

- **Status**: Accepted
- **Date**: 2026-05-15
- **Context tags**: Identity & Onboarding

## Context

When deepening Identity & Onboarding into a state machine (ADR-0001), we
had to choose how `OnboardingProgression` decides which phase a Student
is in: derive it from existing data or persist it as an enum column.

Existing data already encodes phase implicitly:

- `user.name` / `user.surname` — identity completeness
- `userLanguage` rows by `type` (`spoken` / `learning`)
- `userInterest` rows
- `languageProfile.onboardingComplete` — matching-eligible flag (already
  written today by `syncMatchingEligibility` and `submitProfile`)

## Decision

**Compute the phase from a snapshot.** `OnboardingProgression.evaluate`
returns one of `Registering | IdentitySet | Submitted` by inspecting the
snapshot fields directly. No new `user.onboardingPhase` column.

Persistence of *eligibility* is kept on `languageProfile.onboardingComplete`
to preserve the existing read path used elsewhere (no client-visible
behavior change).

Rejected:

- **Explicit phase column** — would require a migration and adds a
  drift surface between the column and the underlying data; transitions
  would need to be written in two places.
- **Persisted progression markers + computed phase** — adds complexity for
  no current benefit; we don't yet need to remember *when* a Student moved
  between phases.

## Consequences

- Single source of truth for phase = the data itself.
- `getOnboardingStatus` now returns `phase` and `missingFields` in addition
  to its legacy fields; clients can use either surface.
- If we later need a `Matched` phase (post-match transition), it will come
  from a cross-context read of `studentMatch`, not a stored column.

## Reference

- `packages/api/src/contexts/identity/onboarding-progression.ts`
- `packages/api/src/contexts/identity/__tests__/onboarding-progression.test.ts`
