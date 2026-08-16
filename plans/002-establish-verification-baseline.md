# Plan 002: Establish one-command verification

> **Executor instructions**: Follow each step, run every gate, and update `plans/README.md` when done.
>
> **Drift check (run first)**: set `<BASELINE_SHA>` to `git rev-list --max-parents=0 HEAD`, then run `git diff --stat <BASELINE_SHA>..HEAD -- package.json pnpm-lock.yaml src tests vitest.config.ts playwright.config.ts`. Compare live files with the excerpts below; STOP on conflicting drift.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `plans/001-establish-git-baseline.md`
- **Category**: tests
- **Planned at**: root baseline created by plan 001, plan authored 2026-08-16

## Why this matters

The worker, persistence, scoring, and provider boundaries will be high-risk code. Today there is no test or typecheck script and no single command that proves the repository is healthy, making delegated implementation unsafe.

## Current state

- `package.json:5-10` exposes only `dev`, `build`, `start`, and `lint`.
- `docs/PRD.md:285` chooses Vitest for domain/worker tests and Playwright for UI flows.
- `src/components/app-shell-block.tsx` contains the current interactive smoke surface: responsive sidebar and command palette.
- Existing verified commands: `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build` all exit 0.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Full check | `pnpm check` | lint, typecheck, unit tests, and build exit 0 |
| UI tests | `pnpm test:e2e` | Chromium smoke suite passes |

## Scope

**In scope**: `package.json`, `pnpm-lock.yaml`, `vitest.config.ts`, `playwright.config.ts`, `tests/unit/utils.test.ts`, `tests/e2e/app-shell.spec.ts`.

**Out of scope**: application behavior, CI hosting, domain contracts, worker code, visual redesign, coverage thresholds.

## Git workflow

- Branch `advisor/002-verification-baseline`; commit `test: establish verification baseline`.
- Do not push or open a PR without operator instruction.

## Steps

### Step 1: Add explicit verification scripts

Add exact scripts: `typecheck: tsc --noEmit`, `test: vitest run`, `test:e2e: playwright test`, and `check: pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Add current stable, lockfile-managed `vitest` and `@playwright/test` as dev dependencies.

**Verify**: `pnpm typecheck` → exit 0; `pnpm test -- --help` → Vitest help, exit 0.

### Step 2: Configure deterministic test runners

Configure Vitest for Node tests and Playwright for Chromium, `baseURL` `http://127.0.0.1:3000`, retries disabled locally, trace on first retry, and a `webServer` using `pnpm dev`. Do not rely on an already-running server.

**Verify**: `pnpm exec playwright test --list` → lists the app-shell tests without starting them.

### Step 3: Add meaningful baseline tests

- `tests/unit/utils.test.ts`: verify `cn()` merges conditional classes and resolves conflicting Tailwind utilities.
- `tests/e2e/app-shell.spec.ts`: verify the title and prospecting summary render, Ctrl+K opens and Escape closes the command palette, and the mobile viewport opens the sidebar sheet.

**Verify**: `pnpm test && pnpm test:e2e` → all tests pass with no console errors.

## Test plan

The new tests are the test plan. Keep selectors role/name-based and avoid generated Base UI IDs or screenshots as assertions.

## Done criteria

- [ ] `pnpm check` exits 0.
- [ ] `pnpm test:e2e` exits 0 on a clean port.
- [ ] Both test files assert behavior, not only rendering.
- [ ] No production dependency was added for test infrastructure.
- [ ] Only in-scope files and the plan index changed.

## STOP conditions

- Port 3000 cannot be isolated through Playwright's `webServer` configuration.
- Tests require changing product behavior or generated shadcn components.
- The root commit is absent or there is more than one root commit.

## Maintenance notes

Add domain tests beside new domain contracts and worker integration tests around real SQLite repositories. Do not replace those with browser-only coverage.

