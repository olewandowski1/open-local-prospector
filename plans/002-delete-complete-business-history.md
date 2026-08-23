# Plan 002: Delete Complete Business History

> **Executor instructions**: Follow every step and verification. Stop on a stated STOP condition.
> Update Plan 002 in `plans/README.md` when complete.
>
> **Drift check (run first)**:
> `git diff --stat b060b46..HEAD -- src/features/workspace-administration/infrastructure/workspace-lifecycle-store.ts src/features/workspace-administration/infrastructure/workspace-store.test.ts`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `b060b46`, 2026-08-23

## Why This Matters

The Delete Business operation currently deletes `run_tasks.business_id` using a Run Business ID,
but production tasks store the Discovered Business ID. Task checkpoints and failures can therefore
survive a user-confirmed deletion. The fix must make the deletion/privacy contract complete while
preserving run-level history that does not belong to the deleted business.

## Current State

```ts
// src/features/workspace-administration/infrastructure/workspace-lifecycle-store.ts:54-74
const associations = database
  .prepare("select id, discovered_business_id from run_businesses where canonical_business_id=?")
  .all(business.id)
// ...
deleteTasks.run(association.id) // Run Business ID, not Discovered Business ID
deleteRunBusiness.run(association.id)
deleteDiscovered.run(association.discovered_business_id)
```

`src/features/business-identity/application/corroborate-business.ts:57-68` creates the next task with
`businessId: discoveredBusinessId`. `run_tasks.business_id` has no foreign key, so deleting the
Discovered Business does not cascade to it. `technical_run_events.business_id` is also an untyped
identifier and must be characterized before deletion logic changes.

Conventions:

- Destructive workspace tests use migrated temporary databases and synthetic businesses.
- Destructive operations run under `withWorkspaceOperationLock` and refuse active runs.
- The product promises deletion of locally held business material, while factual run-level events
  not scoped to that business may remain.

## Commands You Will Need

| Purpose | Command | Expected On Success |
|---|---|---|
| Focused tests | `pnpm test -- workspace-store` | all workspace-store tests pass |
| Architecture | `pnpm check:architecture` | exit 0 |
| Full gate | `pnpm check` | exit 0 |
| Destructive E2E | `pnpm test:e2e:workspace` | one test passes |

## Scope

**In scope**:

- `src/features/workspace-administration/infrastructure/workspace-lifecycle-store.ts`
- `src/features/workspace-administration/infrastructure/workspace-store.test.ts`
- `CHANGELOG.md`

**Out of scope**:

- Changing task schema identifiers globally
- Deleting the whole Prospecting Run
- Changing artifact path safety or workspace locking
- Rewriting historical identifiers through a migration

## Git Workflow

- Branch: `advisor/002-delete-business-history`
- Final commit style: `fix(workspace-administration): delete complete business history`
- Do not push unless instructed.

## Steps

### Step 1: Add A Production-Shaped Regression Fixture

Extend the existing Delete Business test setup with:

- One canonical business.
- One Discovered Business.
- One Run Business referring to it.
- At least two `run_tasks` rows whose `business_id` is the Discovered Business ID.
- One unrelated business and task in the same run.
- Business-scoped `technical_run_events` using every identifier shape production writers currently
  use; inspect the discovery and identity repository writers before fixing expectations.

After deletion, assert the target task/checkpoint/failure rows and target business-scoped events are
gone, the unrelated task/event remains, and run-level events with null `business_id` remain.

**Verify**: `pnpm test -- workspace-store` -> the new test fails against the old implementation for
the target task rows.

### Step 2: Delete By The Stored Identifier

In `deleteBusiness`, use `association.discovered_business_id` for `run_tasks.business_id`. Explicitly
delete business-scoped Technical Run Log rows only after the characterization test proves which
identifier each production writer stores. Keep all related SQL inside the existing transaction.

Preserve the current ordering where required by foreign keys, and do not broaden the delete to all
events for the run.

**Verify**: `pnpm test -- workspace-store` -> target rows are absent and unrelated/run-level rows
remain.

### Step 3: Verify The Destructive Boundary

Run full repository and isolated workspace verification. Add an Unreleased changelog entry stating
that deleting a business now removes its task checkpoints and business-scoped diagnostics.

**Verify**: `pnpm check && pnpm test:e2e:workspace` -> both exit 0.

## Test Plan

- Regression: Run Business ID differs from Discovered Business ID.
- Multiple task stages for one Discovered Business are all deleted.
- Unrelated business task/event remains.
- Run-level Technical Run Log entry remains.
- Artifact deletion reporting remains unchanged.

## Done Criteria

- [ ] No `run_tasks` row remains for any deleted Discovered Business.
- [ ] No business-scoped Technical Run Log material remains for the deleted business.
- [ ] Unrelated and run-level history remains.
- [ ] `pnpm check` and `pnpm test:e2e:workspace` exit 0.
- [ ] Only in-scope files and `plans/README.md` are modified.

## STOP Conditions

- Production writers use conflicting `technical_run_events.business_id` meanings that cannot be
  distinguished during deletion.
- Correct deletion requires a schema migration or changing identifiers outside the in-scope files.
- An active-run deletion path is discovered; do not weaken `assertNoActiveRun`.

## Maintenance Notes

`run_tasks.business_id` and `technical_run_events.business_id` are deliberately not foreign keys.
Any future task/event writer must document which domain identifier it stores, or this bug class will
return. Review deletion tests whenever a new business-scoped durable table is added.

