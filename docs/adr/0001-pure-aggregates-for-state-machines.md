# ADR 0001 — Pure aggregates for bounded-context state machines

- **Status**: Accepted
- **Date**: 2026-05-15
- **Context tags**: Meetup Scheduling, Identity & Onboarding

## Context

The tRPC routers in `packages/api/src/contexts/*` had grown shallow over
multiple features: every state-mutating procedure inlined its own
transition guards, DB queries, persistence, and event emission.
`meetup.ts` reached 1106 LOC across 10 mutations at a 9% test-to-prod
ratio; `profile.ts` reached 598 LOC at a 5% ratio. Pure helpers like
`meetup-utils.ts` and `messaging-utils.ts` had been extracted for
testability, but bugs still hid in *how* those helpers were called
between DB queries — there was no locality for the state machine.

## Decision

State-machine logic lives in **pure aggregate modules** alongside each
context's router:

- `contexts/scheduling/meetup-aggregate.ts` (`Meetup`)
- `contexts/identity/onboarding-progression.ts` (`OnboardingProgression`)

Aggregate methods take a loaded snapshot + input, return
`{ state, events }`, and throw a context-specific `RuleError` on invariant
violations. They own no I/O: routers load snapshots, call the aggregate,
persist the returned state, and emit the returned events.

Rejected alternatives:

- **Tx-aware aggregates** (aggregate accepts a Drizzle tx and runs queries
  itself) — encapsulates I/O but forfeits the fast pure test tier.
- **Repository wrapper** (router → repo → aggregate) — adds a layer of
  indirection without earning leverage at this scale.

## Consequences

**Locality**: each transition's full rule set is in one place. Adding a
new guard means editing one method, not 10 mutations.

**Test surface**: aggregate methods can be tested directly without DB
infrastructure. Routers are tested end-to-end with the pg-mem harness
(see ADR-0002). Existing `*-utils.ts` files remain for genuinely shared
helpers but are no longer the seam.

**Trade-off**: routers still do the DB load + persist; they do not become
trivial pass-throughs. The aggregate is responsible for the *decision*;
the router stays responsible for orchestration.

## Reference

- `packages/api/src/contexts/scheduling/meetup-aggregate.ts`
- `packages/api/src/contexts/identity/onboarding-progression.ts`
- [`docs/CONTEXT.md`](../CONTEXT.md) for vocabulary
