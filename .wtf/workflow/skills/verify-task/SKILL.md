---
name: wtf:verify-task
description: This skill should be used when a QA engineer wants to test or verify a completed task, run through acceptance criteria, check Gherkin scenarios against the implementation, record pass/fail results, or sign off on a ticket before merge. Triggers on phrases like "verify task #42", "run QA on this issue", "test the acceptance criteria", "sign off on task", "check if this task is ready to merge", "does this task meet its acceptance criteria", "run acceptance tests for task #X", "walk through the Gherkin for task #X", or "I want to test this task".
---

# Verify Task

Pick up an existing Task as a QA engineer. Core value: uses the Gherkin scenarios as the executable test script — each scenario is a concrete test case with Given/When/Then steps to run against the implementation.

Read `references/qa-verdict-guide.md` before starting — it defines the status symbols, verdict options, and the expected Test Mapping table format used throughout this skill.

## Process

### 0. GitHub CLI setup

Run steps 1–2 of `@.wtf/workflow/skills/references/gh-setup.md` (install check and auth check). Stop if `gh` is not installed or not authenticated. Extensions are not required for this skill.

Skip this step if invoked from `wtf:implement-task` or another skill that already ran gh-setup this session.

### 1. Identify the Task

Search for recent open issues with labels `task` or `implemented` to populate options. Call `AskUserQuestion` with `question: "Which Task are you testing?"`, `header: "Task"`, and `options` pre-filled with 1–2 likely open Task issue references inferred from GitHub search (e.g. recent open issues labeled `task` or `implemented`).

Fetch the Task first, extract the Feature number from its Context section, then fetch the Feature:

```bash
gh issue view <task_number>    # Gherkin, Contracts, Edge Cases, Test Mapping, DoD — also yields feature number
# Extract feature number, then:
gh issue view <feature_number> # ACs, edge cases for additional probe scenarios
```

Check the task labels. If the `implemented` label is **absent**, warn the user that the task doesn't have an `implemented` label yet and that the recommended flow is: **write-task → design-task → implement-task → verify-task**. Then call `AskUserQuestion` with:

- `question`: "This task hasn't been implemented yet. How would you like to proceed?"
- `header`: "Implement first?"
- `options`: `[{label: "Implement first", description: "Go back and run wtf:implement-task (default)"}, {label: "Verify anyway", description: "Skip and proceed with verification"}]`

- **Implement first** → follow the `wtf:implement-task` process, passing the Task number in as context.
- **Verify anyway** → proceed.

### 2. Load the QA steering document

Check whether `docs/steering/QA.md` exists:

```bash
cat docs/steering/QA.md 2>/dev/null
```

If the file **exists**: read it and keep it in context. Use its test strategy, coverage thresholds, definition of done, and known flaky areas to inform every verification decision in this session. Do not surface it to the user — just apply it silently.

If the file **does not exist**, call `AskUserQuestion` with:

- `question`: "docs/steering/QA.md doesn't exist yet. This document captures your test strategy, coverage thresholds, and definition of done. Would you like to create it now?"
- `header`: "QA steering doc missing"
- `options`: `[{label: "Create it now", description: "Run wtf:steer-qa before continuing (recommended)"}, {label: "Skip for this session", description: "Continue without it — QA decisions won't reference project standards"}]`

- **Create it now** → follow the `wtf:steer-qa` process, then return to this skill and continue from step 3.
- **Skip for this session** → continue without it.

### 3. Establish the test surface

From the Task, extract and present:

- All Gherkin scenarios (these are the test cases)
- The contracts (request/response schemas to verify against)
- Edge Cases & Risks (additional scenarios to probe)
- Observability requirements (logs, metrics, alerts to verify)

Call `AskUserQuestion` with `question: "I found [n] Gherkin scenarios and [m] edge cases to cover. Does this match what you expect?"` (replace [n] and [m] with actual counts), `header: "Test surface"`, and `options: [{label: "Yes — that's everything", description: "Proceed to testing"}, {label: "There are more scenarios", description: "I want to add some"}]`.

### 4. Walk through each Gherkin scenario

For each scenario, one at a time:

1. Present it as a concrete test case — restate the Given/When/Then in plain language.
2. Call `AskUserQuestion` with:
   - `question`: "Did this scenario pass?"
   - `header`: "Result"
   - `options`: `[{label: "Yes ✅", description: "Scenario passed"}, {label: "No ❌", description: "Scenario failed"}, {label: "Blocked 🚫", description: "Could not test due to dependency or environment issue"}, {label: "N/A or Conditional ⚠️", description: "Not applicable, or passes only under a specific condition"}]`
   - **Yes ✅** → mark ✅ in the running Test Mapping table. Set `bug filed` to `—`.
   - **No ❌** → call `AskUserQuestion` with `question: "What actually happened?"`, `header: "Failure details"`, and `options` pre-filled with 1–2 plausible failure modes inferred from the scenario (e.g. "No error shown", "Wrong data returned"). Record findings with repro steps. Then call `AskUserQuestion` with `question: "Would you like to file a bug report now?"`, `header: "File bug?"`, `options: [{label: "File now", description: "Run wtf:report-bug immediately (default)"}, {label: "Continue and file later", description: "Defer and move to the next scenario"}]` — if "File now", follow the `wtf:report-bug` process immediately with the task number and scenario details before moving on. Mark `bug filed` as `yes` (filed now) or `no` (deferred). Set `bug filed` accordingly.
   - **Blocked 🚫** → call `AskUserQuestion` with `question: "What dependency or environment issue prevented testing?"`, `header: "Blocker"`, and `options` pre-filled with common blockers inferred from the task context (e.g. "Missing test environment", "Depends on unmerged task"). Set `bug filed` to `—`.
   - **N/A or Conditional ⚠️** → call `AskUserQuestion` with `question: "Is this N/A, or does it pass only under a condition?"`, `header: "Condition"`, and `options: [{label: "N/A — not applicable", description: "This scenario does not apply"}, {label: "Conditional — specify the condition", description: "Passes only under a specific circumstance"}]`. Record appropriately. Set `bug filed` to `—` (track the condition separately).
3. After recording the result, **immediately update the Task issue** with the current state of the Test Mapping table (do not wait until all scenarios are done). The table must include a `Bug Filed` column:

   The running Test Mapping table format (update after every scenario):

   | Scenario          | Result          | Bug Filed    |
   | ----------------- | --------------- | ------------ |
   | `<scenario name>` | ✅/❌/🚫/N/A/⚠️ | yes / no / — |

   ```bash
   gh issue view <task_number> --json body -q .body > /tmp/updated-task-body.md
   ```

   Programmatically replace the Test Mapping table section in `/tmp/updated-task-body.md` using the Write or Edit tool, preserving all other sections unchanged. Then push:

   ```bash
   gh issue edit <task_number> --body-file /tmp/updated-task-body.md
   ```

4. Keep a running tally. After updating, confirm: "Updated. Moving to next scenario..."

### 5. Probe the edge cases

For each Edge Case listed in the Task (and the parent Feature), one at a time:

1. Derive a concrete test action from the edge case description.
2. Call `AskUserQuestion` with:
   - `question`: "Did this edge case pass?"
   - `header`: "Result"
   - `options`: `[{label: "Yes ✅", description: "Edge case passed"}, {label: "No ❌", description: "Edge case failed"}, {label: "Blocked 🚫", description: "Could not test"}, {label: "N/A", description: "Not applicable"}]`
   - **No ❌** → call `AskUserQuestion` with `question: "What actually happened?"`, `header: "Failure details"`, and `options` pre-filled with 1–2 plausible failure modes inferred from the edge case. Record findings with repro steps, then ask to file a bug report as in step 4.
3. After each result, update the Task issue — append an Edge Cases section (or update it if present) with the same table format used in step 4.

### 6. Verify observability

For each item in the Observability section (logs, metrics, alerts), one at a time:

1. Call `AskUserQuestion` with:
   - `question`: "Was this observability item present and correct?"
   - `header`: "Result"
   - `options`: `[{label: "Yes ✅", description: "Present and correct"}, {label: "No ❌", description: "Missing or incorrect"}, {label: "N/A", description: "Not applicable to this task"}]`
2. Record the result. On ❌, ask for details and offer to file a bug report as in step 4.
3. After each result, update the Task issue with an Observability Results section.

### 7. Finalize results and post QA summary

The Test Mapping table has been updated after each scenario (step 4). Now do a final update: check off DoD items that passed; leave failing ones unchecked.

```bash
gh issue view <task_number> --json body -q .body > /tmp/updated-task-body.md
```

Programmatically update the DoD checklist in `/tmp/updated-task-body.md` using the Write or Edit tool. Then push:

```bash
gh issue edit <task_number> --body-file /tmp/updated-task-body.md
```

Post a QA summary comment:

```bash
gh issue comment <task_number> --body "<qa_summary>"
```

The QA summary must include:

- Total scenarios tested and pass/fail/conditional count
- Any findings with repro steps
- Conditional passes: list each ⚠️ scenario with its required condition
- Clear verdict: ✅ Ready for merge / ❌ Needs fixes / ⚠️ Conditional pass (list conditions)

If the verdict is ✅ or ⚠️, add the `verified` lifecycle label:

```bash
gh issue edit <task_number> --add-label "verified"
```

Print the updated Task issue URL.

### 8. Offer to open a PR

If the verdict is ✅ or ⚠️, call `AskUserQuestion` with:

- `question`: "Task verified. Would you like to open a pull request now?"
- `header`: "Open PR?"
- `options`: `[{label: "Open PR now", description: "Create a pull request for this branch (recommended next step)"}, {label: "Skip for now", description: "Exit — I'll open the PR later"}]`

- **Open PR now** → follow the `wtf:create-pr` process, passing the Task number in as context.
- **Skip for now** → continue.

### 9. Offer bug reports for remaining failures

Check all result tables (Gherkin scenarios from step 4, edge cases from step 5, observability from step 6): find all rows where Result is ❌ and `Bug Filed` is `no`. These are the unfiled failures.

If none exist, skip this step entirely.

If unfiled failures exist, present them as a numbered list, then call `AskUserQuestion` with:

- `question`: "[n] failing scenario(s) without a bug report. How would you like to handle them?" _(replace [n] with the actual count)_
- `header`: "File bugs?"
- `options`: `[{label: "File separately", description: "File one bug report per failing scenario (default)"}, {label: "File combined", description: "File one combined bug report for all failures"}, {label: "Skip", description: "Exit — I'll handle it manually"}]`

- **File separately** → follow the `wtf:report-bug` process once per failing scenario, passing in the task number and the specific failing scenario each time.
- **File combined** → follow the `wtf:report-bug` process once, passing in the task number and all failing scenarios together.
- **Skip** → exit without filing reports.
