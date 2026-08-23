# Plan 006: Test The Assembled Worker Pipeline Offline

> **Executor instructions**: Follow every step and verification. Use deterministic fake external
> adapters but real application services, repositories, task routing, and SQLite transitions. Stop
> rather than replacing production layers with mocks. Update Plan 006 in `plans/README.md` when done.
>
> **Drift check (run first)**:
> `git diff --stat b060b46..HEAD -- src/features/run-execution src/worker/main.ts src/test-support src/features/mvp-evaluation`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: Plans 004 and 005
- **Category**: tests
- **Planned at**: commit `b060b46`, 2026-08-23

## Why This Matters

The synthetic browser suite starts Next.js over a seeded completed workspace, while the worker unit
test supplies a fake StageExecutor. No deterministic offline test assembles production stage routing,
SQLite repositories, durable next-task payloads, assessment persistence, and scoring from a Search
Brief to a terminal run. Individual tests can pass while stage names, payloads, repository rows, or
checkpoint transitions disagree.

## Current State

- `src/features/run-execution/application/worker.test.ts:36-66` proves claim/settle behavior with a
  fake executor that only updates a run timestamp.
- `src/features/run-execution/infrastructure/stage-executor-live.ts:19-43` routes Run Planning,
  Discover Businesses, Corroborate Business, Inspect Website, Assess Website Opportunity, and Score
  Candidate but has no assembled test.
- `playwright.config.ts:19-35` seeds a finished workspace and starts only the web process.
- `src/worker/main.ts` is the real composition root. Do not import it directly if doing so starts
  process-level work; extract only a composition helper if necessary.
- Existing `createMigratedTestDatabase`, Prospecting Run helpers, and evaluation fixtures are the
  preferred test support.

Constraints:

- Use the real SQLite repositories and stage executors.
- Replace web search, provider reasoning, DNS/network, and Chromium only at their narrow application
  interfaces with deterministic adapters.
- No network, provider credentials, real business data, or arbitrary sleeps.
- Durable state, not React rendering, is the assertion target.

## Commands You Will Need

| Purpose | Command | Expected On Success |
|---|---|---|
| New integration test | `pnpm test -- assembled-worker-pipeline` | all new cases pass |
| Worker tests | `pnpm test -- worker run-task` | all matching tests pass |
| Architecture | `pnpm check:architecture` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Full gate | `pnpm check` | exit 0 |

## Scope

**In scope**:

- A new colocated integration test under `src/features/run-execution/`, named for the assembled worker pipeline
- Minimal composition helpers extracted from `src/worker/main.ts` if necessary
- `src/test-support/` helpers that are genuinely reused by this test and existing tests
- Versioned fixtures from Plan 005
- `CHANGELOG.md`

**Out of scope**:

- Starting the real provider CLIs or Playwright browser
- Browser/UI assertions
- Changing production stage semantics to make testing easier
- A second workflow engine or in-memory repository implementation
- Live-runtime comparison behavior

## Git Workflow

- Branch: `advisor/006-assembled-worker-test`
- Use logical commits such as `refactor(run-execution): expose worker composition` followed by
  `test(run-execution): cover assembled pipeline` only if extraction is required.
- Do not push unless instructed.

## Steps

### Step 1: Define The Smallest Testable Composition Boundary

Identify the code in `src/worker/main.ts` that binds stage executors and repositories. Prefer a pure
feature-local factory returning the StageExecutor Layer and required services. Keep executable
resolution, process logging, and the infinite worker loop in `main.ts`.

If the production composition can already be assembled directly from exported factories, do not
refactor it merely for aesthetics.

**Verify**: `pnpm check:architecture && pnpm typecheck` -> exit 0 before adding the long workflow test.

### Step 2: Build Deterministic External Adapters

Using Plan 005 fixtures, provide:

- A Discovery Runtime returning a fixed report and structured output.
- A Website Inspector returning fixed desktop/mobile evidence and an allowed citation timestamp.
- An Assessment Runtime returning schema-valid output tied to that evidence.

Use real discovery, identity, inspection, assessment, scoring task executors and their real SQLite
repositories. Do not mock repository methods.

**Verify**: a focused test can execute each external adapter through its application service and
persist one expected row without network access.

### Step 3: Drive One Run To A Terminal State

Create a confirmed Prospecting Run in a migrated temporary database. Repeatedly invoke the real
`runWorkerCycle` with the assembled production StageExecutor until no tasks remain active. Bound the
number of cycles explicitly; do not wait on the infinite worker loop.

Assert:

- Every expected durable stage exists and completes once.
- Next-task payloads carry the correct Run, Discovered Business, Run Business, Canonical Business,
  inspection, and assessment identifiers.
- The final Candidate has cited evidence, an allowed timestamp, deterministic score breakdown, and
  expected qualification.
- The run reaches the expected terminal completion state.

**Verify**: `pnpm test -- assembled-worker-pipeline` -> happy-path case passes without network or timers.

### Step 4: Prove Restart Idempotency And Partial Failure

Add two cases:

1. Stop after a middle checkpoint, close all database handles, rebuild the composition, and continue.
   Completed stages must not repeat or duplicate rows.
2. Return one permanent per-business inspection/assessment failure beside one successful business.
   The successful Candidate completes and the run records the bounded partial outcome rather than
   failing globally.

Use database counts and stable IDs/checkpoint states, not provider prose, for assertions.

**Verify**: `pnpm test -- assembled-worker-pipeline` -> all cases pass repeatedly.

### Step 5: Run Full Verification

Add an Unreleased changelog entry for the assembled offline worker coverage.

**Verify**: run the focused test twice, then `pnpm check`; all exit 0 and produce no external calls.

## Test Plan

- Full happy path from confirmed Search Brief to qualified Candidate.
- Restart after at least one committed middle stage.
- One business fails permanently while another completes.
- Citation URL/time and score qualification match Plan 005 fixtures.
- Explicit cycle bound fails with a useful assertion if workflow progress stalls.
- Database cleanup closes handles on success and failure, especially on Windows.

## Done Criteria

- [ ] A deterministic offline test crosses every production durable stage.
- [ ] Real SQLite repositories and task routing are used.
- [ ] External network/browser/provider behavior is replaced only at narrow interfaces.
- [ ] Restart does not duplicate completed work.
- [ ] One business failure does not fail the whole run.
- [ ] The test performs zero external network/provider calls and uses no fixed sleeps.
- [ ] Two focused runs and `pnpm check` exit 0.
- [ ] Only in-scope files and `plans/README.md` are modified.

## STOP Conditions

- The test requires importing `src/worker/main.ts` in a way that starts the infinite worker loop.
- Production repositories cannot be assembled without real provider/browser executables.
- Passing requires altering durable stage semantics or weakening restart guarantees.
- Database handles cannot be deterministically closed in the test on Windows.

## Maintenance Notes

This test is the compatibility contract for durable stage payloads. Any new stage, task-input schema
version, or repository handoff must update it. Keep detailed presentation behavior in Playwright and
small pure rules in unit tests; do not turn this integration test into a catch-all suite.

