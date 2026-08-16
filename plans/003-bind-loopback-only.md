# Plan 003: Bind the local server to loopback by default

> **Executor instructions**: Follow the plan exactly and update the index when done.
>
> **Drift check (run first)**: `git diff --stat <BASELINE_SHA>..HEAD -- package.json tests` using the root SHA from plan 001. STOP if server scripts changed incompatibly.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans 001 and 002
- **Category**: security
- **Planned at**: root baseline created by plan 001, plan authored 2026-08-16

## Why this matters

Next.js defaults both development and production servers to `0.0.0.0`. That exposes the local-first application to the LAN and contradicts the explicit Local Application privacy boundary.

## Current state

- `package.json:6-8`: `dev` is `next dev`; `start` is `next start`.
- Installed `next dev --help` and `next start --help` report hostname default `0.0.0.0`.
- `CONTEXT.md:145` and `docs/PRD.md:53` require `127.0.0.1` unless explicitly changed.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Verify repository | `pnpm check` | exit 0 |
| Inspect listener | `Get-NetTCPConnection -LocalPort 4310 -State Listen` | LocalAddress is `127.0.0.1` |

## Scope

**In scope**: `package.json` and one regression assertion in the existing verification suite.

**Out of scope**: remote-access UI, authentication, TLS, firewall configuration, alternate ports, Docker, or deployment hosting.

## Git workflow

- Branch `advisor/003-loopback-binding`; commit `fix: bind local server to loopback`.

## Steps

### Step 1: Make loopback binding explicit

Change `dev` and `start` to bind `127.0.0.1` explicitly. Per the later product decision, standardize both commands on the project-specific port `4310`. Do not add a network-access script.

**Verify**: start `pnpm dev`, inspect port 4310, then terminate only the process started for this test. The listener address must be `127.0.0.1`, never `0.0.0.0` or `::`.

### Step 2: Protect the package contract

Add a small test that reads `package.json` and asserts both commands include the explicit loopback hostname. This is a security invariant, not an implementation-detail snapshot.

**Verify**: `pnpm check` → exit 0.

## Test plan

Test both script strings and perform one real listener inspection. Do not attempt a LAN connection or modify firewall state.

## Done criteria

- [x] Development and production scripts explicitly bind `127.0.0.1`.
- [x] Regression assertion passes.
- [x] `pnpm check` exits 0.
- [x] No remote-access mode was introduced.

## STOP conditions

- Next no longer accepts `--hostname` for either command.
- The change requires authentication or network configuration.
- Port 4310 belongs to an unrelated process; do not stop it.

## Maintenance notes

Any future remote or multi-user mode requires a separate threat model, authentication, authorization, CSRF policy, and an explicit opt-in configuration.
