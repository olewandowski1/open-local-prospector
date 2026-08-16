# Plan 001: Establish a safe Git baseline

> **Executor instructions**: Follow every step and verification gate. Do not modify source content. When complete, update this plan's row in `plans/README.md` unless a reviewer owns the index.
>
> **Drift check (run first)**: `git rev-parse --is-inside-work-tree`
> Expected current result: non-zero with “not a git repository”. If it succeeds, STOP because a repository was initialized after this plan was authored.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: unversioned workspace, 2026-08-16

## Why this matters

Every subsequent architecture change needs review, rollback, and drift detection. The project currently has no Git metadata, so executor agents cannot distinguish the audited snapshot from later edits.

## Current state

- `git rev-parse --is-inside-work-tree` fails.
- `.gitignore` already excludes `node_modules`, `.next`, environment files, debug logs, and `*.tsbuildinfo`.
- The source tree includes product documents, ADRs, the Next.js UI scaffold, MCP configuration, and these plans.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Inspect ignores | `git check-ignore node_modules .next tsconfig.tsbuildinfo` | all three paths printed |
| Initialize | `git init -b main` | exit 0 |
| Inspect staged files | `git status --short` | no ignored build/dependency/env files |

## Scope

**In scope**: Git metadata and the first commit only.

**Out of scope**: changing source, docs, configuration, generated dependencies, global Git configuration, remotes, pushes, or GitHub setup.

## Git workflow

- Initialize branch `main`.
- Create one root commit: `chore: establish project baseline`.
- Do not add a remote or push.

## Steps

### Step 1: Validate ignored local material

Run `git check-ignore node_modules .next tsconfig.tsbuildinfo`. Confirm all paths are ignored. Also run `git status --ignored --short` after initialization and verify `.env*`, provider credentials, `.next`, and `node_modules` will not be staged.

**Verify**: `git status --ignored --short` → ignored local/generated directories are prefixed `!!`.

### Step 2: Initialize and commit the audited snapshot

Run `git init -b main`, stage repository files with `git add .`, inspect `git diff --cached --stat` and `git diff --cached --name-only`, then commit with the message above.

**Verify**: `git status --short` → no output; `git rev-list --max-parents=0 HEAD` → exactly one SHA.

## Test plan

No application tests are added. The safety test is inspection of the staged file list before committing.

## Done criteria

- [x] Exactly one root commit exists on `main`.
- [x] `git status --short` is empty.
- [x] No ignored dependency, build, environment, database, artifact, or credential file is tracked.
- [x] No remote exists unless it predated this plan (which is a STOP condition).
- [x] Status row updated.

## STOP conditions

- Git already exists, a remote exists, or files have staged changes.
- Git author identity is missing; ask the operator rather than modifying global configuration.
- Any potential secret or local database/artifact appears in the staged list.
- Completing the baseline would require editing a non-Git file.

## Maintenance notes

The root commit produced here is the `<BASELINE_SHA>` used by later plans. Preserve it; do not squash it away while those plans remain active.
