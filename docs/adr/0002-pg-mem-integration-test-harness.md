# ADR 0002 — pg-mem-backed integration test harness

- **Status**: Accepted (with known drift hazards documented)
- **Date**: 2026-05-15
- **Context tags**: Test infrastructure

## Context

QA.md targets "tRPC router + Drizzle + real PostgreSQL" for integration
coverage, but no harness existed and procedure-level tests had been
substituted with module-mocking — `mock.module("@sip-and-speak/db", ...)`
plus `mock.module("drizzle-orm", ...)` across 18 notification test files.
Mock-leak fragility was already on the architecture backlog. The pure
aggregate unit tests introduced in ADR-0001 do not cover cross-context
wiring: foreign-key constraints, transaction boundaries, event subscriber
side effects, raw-`sql` joins.

## Decision

Use **pg-mem** (`pg-mem@3.0.14`) as the integration test DB. Harness lives
at `packages/api/src/__test-support__/harness.ts` and:

1. Boots a pg-mem instance and registers PG built-ins (`gen_random_uuid`,
   `now`) that pg-mem ships without.
2. Applies migrations driven by `packages/db/src/migrations/meta/_journal.json`
   (avoids orphan squashed migrations that `readdir` would catch).
3. Wraps the pg-mem `Pool` and `Client` to strip drizzle's `rowMode:"array"`
   and `types.getTypeParser` query options that pg-mem rejects, then
   reshapes object rows into positional arrays using the first row's keys
   (pg-mem returns an empty `fields` array).
4. Snapshots the post-migration state via `pg-mem`'s `backup()` for O(1)
   `resetDb()` between tests.
5. Calls `mock.module("@sip-and-speak/db", ...)` at module load, so
   importing the harness at the top of a test file is sufficient.

Helpers exposed: `resetDb`, `captureEvents`, `buildSessionContext`,
`testDb`, `memDb`.

Rejected alternatives:

- **Docker PG + tx rollback** — recommended by the agent for production-PG
  fidelity. Rejected: heavier infra, slower per-test setup.
- **Testcontainers per suite** — too slow for our test count.
- **Shared PG + truncate** — parallel test contention risk; truncate is
  slower than pg-mem `restore()`.

## Consequences

**Pros**:
- ms-level test boot (10ms typical for the smoke test, ~50ms per
  integration test).
- No new infrastructure commitments.
- Aggregate (`meetup-aggregate.test.ts`) and integration
  (`meetup-integration.test.ts`) tiers run in the same `bun test` command.

**Hazards (drift risk)**:
- pg-mem does not implement every PG feature. Known wrappers required:
  `rowMode`, `types.getTypeParser`. Future drizzle changes may surface
  more.
- `fields` is reconstructed from row keys, which relies on pg-mem
  preserving V8 insertion order. Holds today; would break if pg-mem ever
  shuffles.
- The harness mocks `@sip-and-speak/db` at module level. Tests that need
  a *different* DB instance per file are not supported by this design.

## When to revisit

- pg-mem upstream falls further behind drizzle (more `NotSupported`
  errors than we can patch).
- We need PG-specific behaviour the JS emulator cannot model (advisory
  locks, `LATERAL`, JSONB operators, true transaction isolation).
- A second test runner enters the picture that does not honour
  `mock.module` semantics.

Switch path: replace pg-mem with **PGlite** (`@electric-sql/pglite`).
Official drizzle adapter, real PG in WASM, no `rowMode` hacks. Migration
would change the harness, not the test files.

## Reference

- `packages/api/src/__test-support__/harness.ts`
- `packages/api/src/__test-support__/__tests__/harness-smoke.test.ts`
- `packages/api/src/contexts/scheduling/__tests__/meetup-integration.test.ts`
- `packages/api/src/contexts/identity/__tests__/onboarding-integration.test.ts`
