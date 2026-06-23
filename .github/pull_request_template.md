## Summary

<!-- Why does this change exist? Reference the Task intent and the Feature goal it serves. -->

## Changes

<!-- Grouped logical summary of what changed — not a file list. -->

## Test plan

<!-- Checklist derived from Gherkin scenario names. At minimum one item per observable behavior changed. -->

- [ ] 

## Schema changes

<!-- Only if this PR adds or changes a table that references a member (user.id). -->

- [ ] New member-data references `onDelete: "cascade"` (deleted on account deletion), or are added to `INTENTIONAL_NON_CASCADE` in `packages/db/src/__tests__/cascade-on-delete.test.ts` and documented in `docs/account-data-deletion-audit.md`.

## Related

<!-- Closes #<task_number> -->
