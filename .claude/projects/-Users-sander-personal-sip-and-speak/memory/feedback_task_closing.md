---
name: Task closing behavior
description: When to close task issues in the wtf workflow
type: feedback
---

Do NOT manually close task issues after their PR merges into a feature branch. Task issues should remain open and will be closed naturally when the feature branch PR merges into main (via `Closes #N` in the feature PR body).

**Why:** GitHub only auto-closes issues when PRs merge into the default branch. Manually closing tasks mid-flow adds noise and doesn't reflect the actual done state.

**How to apply:** In `wtf:loop` and `wtf:create-pr`, never call `gh issue close` on task issues. Only the feature PR (→ main) should trigger closures.
