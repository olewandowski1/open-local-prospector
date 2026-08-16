# Plan 005: Replace generated onboarding documentation

> **Executor instructions**: Write documentation for the repository as it exists after plans 002–004, not for unimplemented MVP features. Verify every documented command.
>
> **Drift check (run first)**: `git diff --stat <BASELINE_SHA>..HEAD -- README.md package.json components.json docs/PRD.md CONTEXT.md` using the root SHA from plan 001. Reconcile completed prerequisite changes before editing.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans 001–004
- **Category**: docs
- **Planned at**: root baseline created by plan 001, plan authored 2026-08-16

## Why this matters

The README is untouched create-next-app text. It sends contributors to the wrong source path, recommends unsupported package managers, and frames Vercel deployment as the goal even though this is a host-native, local-only application.

## Current state

- `README.md:8-14` recommends npm, yarn, pnpm, and bun; the project pins pnpm.
- `README.md:19` points to `app/page.tsx`; the real path is `src/app/page.tsx`.
- `README.md:32-34` recommends Vercel deployment.
- `docs/PRD.md:48` promises `pnpm install`, `pnpm setup`, and `pnpm dev`; `pnpm setup` is not implemented yet, so it must be labeled planned rather than documented as working.
- `docs/PRD.md:344` chooses the MIT license, but no `LICENSE` file currently exists.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Verify documented checks | `pnpm check` | exit 0 |
| Verify development | `pnpm dev` | local URL uses `127.0.0.1` |
| Check links/paths | `Test-Path <each local path named in README>` | `True` |

## Scope

**In scope**: `README.md`, `LICENSE` (create), and no other files.

**Out of scope**: implementing `pnpm setup`, adding runtime/database/browser dependencies, changing PRD/ADRs, deployment instructions, outreach guidance.

## Git workflow

- Branch `advisor/005-readme`; commit `docs: document local project workflow`.

## Steps

### Step 1: Replace boilerplate with product onboarding

Document: purpose and current prototype status; Node current LTS and pinned pnpm prerequisites; `pnpm install`, `pnpm dev`, `pnpm check`, and `pnpm test:e2e`; localhost-only behavior; source/docs layout; shadcn and 7Ovr usage; project-scoped MCP configuration and Claude approval; links to `CONTEXT.md`, PRD, and ADRs. Include a clearly labeled “planned, not implemented” section for SQLite, worker, Brave Search, Playwright inspection, and provider adapters.

**Verify**: every command copied from `package.json` runs or prints help successfully; every local link resolves.

### Step 2: Add the selected license

Create the standard MIT license text with year 2026 and the operator-approved copyright holder. Ask for the holder name if it cannot be determined; do not guess a legal identity.

**Verify**: `Test-Path LICENSE` → `True`; README links to it.

### Step 3: Remove contradictory boilerplate

**Verify**: `rg "npm run dev|yarn dev|bun dev|Deploy on Vercel|app/page.tsx" README.md` → no matches; `pnpm check` → exit 0.

## Test plan

No code tests. Perform commands and link/path checks exactly as documented.

## Done criteria

- [x] README distinguishes implemented prototype behavior from roadmap behavior.
- [x] Only pnpm commands are presented as supported.
- [x] Localhost privacy boundary and MCP workflow are clear.
- [x] Standard MIT `LICENSE` exists with operator-approved holder.
- [x] `pnpm check` exits 0.

## STOP conditions

- Prerequisite scripts/configs do not match the README's intended commands.
- The legal copyright holder is unknown.
- Accurate onboarding requires claiming an unimplemented feature works.

## Maintenance notes

Update “current status” whenever a vertical slice lands. Never turn roadmap acceptance criteria into setup instructions before the corresponding command works.
