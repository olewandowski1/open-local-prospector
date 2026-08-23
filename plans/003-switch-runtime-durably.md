# Plan 003: Switch A Resumed Run's Runtime Durably

> **Executor instructions**: Follow every step and verification. Stop on a stated STOP condition.
> Update Plan 003 in `plans/README.md` when complete.
>
> **Drift check (run first)**:
> `git diff --stat b060b46..HEAD -- src/features/run-monitoring/infrastructure/sqlite-run-monitoring.ts src/features/run-monitoring/infrastructure/sqlite-run-monitoring.test.ts src/features/business-discovery/application/discover-businesses.ts`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `b060b46`, 2026-08-23

## Why This Matters

ADR 0003 explicitly permits an interrupted Prospecting Run to resume with another runtime and
requires the change to be recorded. Today the run record changes but blocked durable task input does
not. A blocked discovery can therefore retry the unavailable old runtime while the Run Detail says
the new runtime is selected. The fix must update only unfinished runtime-consuming work and must
never rewrite completed checkpoints.

## Current State

```ts
// src/features/run-monitoring/infrastructure/sqlite-run-monitoring.ts:289-293
const brief = JSON.parse(raw) as SearchBrief
if (brief.runtime === runtime) return
database.prepare("update prospecting_runs set search_brief=? where id=?")
  .run(JSON.stringify({ ...brief, runtime }), runId)
```

```ts
// src/features/run-monitoring/infrastructure/sqlite-run-monitoring.ts:314-321
update run_tasks set status = 'Pending', available_at = ?, failure = null,
updated_at = ?, version = version + 1 where run_id = ? and status = 'Blocked'
```

The persisted task input is not changed. Discovery reads the Search Brief from task input in
`src/features/business-discovery/application/discover-businesses.ts:42`. A Search Brief may also
carry provider-specific `runtimeConfiguration`; blindly retaining it while changing provider can
produce an invalid model/effort combination.

Constraints:

- Completed work and checkpoints remain immutable.
- The runtime change and task rewrite occur in the existing transaction.
- The Technical Run Log continues recording old and new runtime without hidden reasoning.
- No silent runtime fallback is allowed. This path runs only on explicit Resume.

## Commands You Will Need

| Purpose | Command | Expected On Success |
|---|---|---|
| Focused tests | `pnpm test -- sqlite-run-monitoring` | all tests pass |
| Worker tests | `pnpm test -- worker discover-businesses` | all matching tests pass |
| Typecheck | `pnpm typecheck` | exit 0 |
| Full gate | `pnpm check` | exit 0 |
| App E2E | `pnpm test:e2e` | all configured non-skipped tests pass |

## Scope

**In scope**:

- `src/features/run-monitoring/infrastructure/sqlite-run-monitoring.ts`
- `src/features/run-monitoring/infrastructure/sqlite-run-monitoring.test.ts`
- A small feature-local helper/test if needed to rewrite versioned task input safely
- `CHANGELOG.md`

**Out of scope**:

- Automatic fallback between runtimes
- Changing runtime while a task is Leased
- Re-executing completed tasks
- Selecting a model/effort for the user when only a runtime ID was provided
- Changing provider command adapters

## Git Workflow

- Branch: `advisor/003-switch-runtime-durably`
- Final commit style: `fix(run-monitoring): switch resumed task runtime durably`
- Do not push unless instructed.

## Steps

### Step 1: Characterize A Blocked Discovery Resume

Create a migrated database fixture containing a run whose Search Brief selects one runtime and a
Blocked `DiscoverBusinesses` task whose versioned input contains the same brief. Include a Completed
task as an immutability sentinel. Resume with another runtime.

Assert before implementing the fix:

- The run Search Brief changes.
- The blocked task becomes Pending.
- The pending task input still incorrectly names the old runtime.
- The completed task remains untouched.

Add a second case where `runtimeConfiguration` belongs to the old provider.

**Verify**: `pnpm test -- sqlite-run-monitoring` -> the new task-input assertion fails against old
code for the intended reason.

### Step 2: Define A Versioned Task-Input Rewrite

Implement a pure helper that accepts an unknown persisted task input and the new Runtime ID. It may
rewrite only recognized current-version input containing a Search Brief. It must:

- Set `searchBrief.runtime` to the explicitly selected runtime.
- Remove `searchBrief.runtimeConfiguration` because the resume request does not provide a validated
  configuration for the new provider.
- Preserve every unrelated Search Brief and task-input field.
- Refuse malformed or unknown-version shapes rather than guessing.

Unit-test the helper with valid input, absent configuration, malformed JSON, missing Search Brief,
and unrelated nested objects.

**Verify**: focused helper tests pass.

### Step 3: Rewrite Only Eligible Durable Tasks In The Resume Transaction

Inside `changeRuntime`, load Pending/Blocked runtime-consuming tasks for the run, rewrite their
recognized input, and persist it with version increment in the same transaction as the run Search
Brief and `RuntimeChanged` event. Never change Completed, Cancelled, Leased, or FailedPermanent task
input. Resume can then reopen the Blocked task using the new input.

If only `DiscoverBusinesses` consumes runtime from task input today, name that scope explicitly in
code and tests instead of pretending every stage shares the same shape.

**Verify**: `pnpm test -- sqlite-run-monitoring discover-businesses` -> the retried task selects the
new runtime, old configuration is absent, and completed task JSON is byte-for-byte unchanged.

### Step 4: Run Full Verification

Record an Unreleased fix explaining that explicit resume now updates unfinished durable task input
and removes incompatible provider configuration.

**Verify**: `pnpm check && pnpm test:e2e` -> both exit 0.

## Test Plan

- Blocked discovery switches from each Runtime ID to another.
- Provider-specific runtime configuration is removed.
- Completed, Cancelled, FailedPermanent, and Leased tasks are unchanged.
- Re-selecting the current runtime remains idempotent.
- RuntimeChanged records verified old/new runtime names.
- Malformed/unknown task input aborts the transaction rather than partially changing the run.

## Done Criteria

- [ ] The run record and eligible unfinished task inputs agree on runtime after explicit Resume.
- [ ] Old provider-specific configuration is not retained.
- [ ] Completed and currently Leased work is unchanged.
- [ ] The operation is transactional and produces one RuntimeChanged event.
- [ ] `pnpm check` and `pnpm test:e2e` exit 0.
- [ ] Only in-scope files and `plans/README.md` are modified.

## STOP Conditions

- A currently Leased task must be switched to satisfy existing product behavior.
- More than one incompatible versioned task-input shape is active in supported workspaces.
- Selecting valid model/effort for the new runtime requires new user input or an unstated default.
- The fix would silently retry completed work.

## Maintenance Notes

Any future stage that embeds a Search Brief or runtime configuration in durable input must join this
rewrite contract explicitly. Reviewers should reject a generic recursive JSON replacement because
it could mutate evidence/checkpoints that merely contain a field named `runtime`.

