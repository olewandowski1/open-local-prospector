# Plan 007: Decompose the UI spike along server/client and feature boundaries

> **Executor instructions**: Preserve the rendered experience and interactions. This is a structural extraction only; do not connect APIs or redesign the screen. Update the index when done.
>
> **Drift check (run first)**: `git diff --stat <BASELINE_SHA>..HEAD -- src/app src/components src/features tests` using the root SHA from plan 001. STOP if the overview already uses real data or its layout materially changed.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans 002 and 006
- **Category**: tech-debt
- **Planned at**: root baseline created by plan 001, plan authored 2026-08-16

## Why this matters

`app-shell-block.tsx` currently owns navigation, user menus, fixtures, command state, and the entire overview. Connecting real application contracts there would turn one client component into both the application shell and feature controller. Extracting stable seams now lets pages remain server-rendered while only interactive shell islands opt into client execution.

## Current state

- `src/components/app-shell-block.tsx:80-90` defines navigation.
- `src/components/app-shell-block.tsx:92-129` defines overview fixtures.
- `src/components/app-shell-block.tsx:132-174` defines user/navigation components.
- `src/components/app-shell-block.tsx:176-369` renders the shell, overview, and command dialog under one `"use client"` boundary.
- `src/app/page.tsx:1-5` renders that component directly.
- shadcn components under `src/components/ui/` are generated primitives; do not refactor them except for a demonstrated defect.

## Target shape

```text
src/components/app-shell/app-shell.tsx           client shell accepting children
src/components/app-shell/app-navigation.ts       typed navigation configuration
src/components/app-shell/workspace-command.tsx   client command dialog
src/components/app-shell/user-menu.tsx            client user menu
src/features/overview/overview-page.tsx           server-compatible presentation
src/features/overview/overview-fixtures.ts        clearly labeled temporary fixtures
src/app/page.tsx                                  composes AppShell + OverviewPage
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Full verification | `pnpm check` | exit 0 |
| UI regression | `pnpm test:e2e` | existing desktop/mobile tests pass |
| Client audit | `rg '^"use client"' src/features/overview` | no output unless an extracted interaction proves it necessary |

## Scope

**In scope**: `src/components/app-shell-block.tsx` (remove after migration), new `src/components/app-shell/**`, new `src/features/overview/**`, `src/app/page.tsx`, and focused test updates caused by file/module names.

**Out of scope**: shadcn primitive rewrites, APIs, TanStack Query, Effect, real persistence, routing destinations, new dashboard features, colors/typography/layout changes.

## Git workflow

- Branch `advisor/007-decompose-ui`; commit `refactor: separate app shell from overview`.

## Steps

### Step 1: Extract stable configuration and fixtures

Move navigation to a typed pure module. Move stats, runs, and candidates to `overview-fixtures.ts`, exporting readonly values explicitly marked temporary. Do not let fixture types become domain types; use presentation-only names such as `OverviewRunItem`.

**Verify**: `pnpm typecheck` → exit 0; old constants no longer occur in `app-shell-block.tsx`.

### Step 2: Extract client interaction islands

Move user menu and command dialog/state into focused client components. Create `AppShell` as the sidebar/header client boundary accepting `children: ReactNode`. Keep keyboard listener cleanup and Base UI/shadcn composition intact.

**Verify**: focused lint/typecheck pass; Ctrl+K and Escape E2E assertions pass.

### Step 3: Extract the overview as server-compatible presentation

Move the summary/cards/lists into `OverviewPage` without `"use client"`. Pass it as children from server `src/app/page.tsx` into `AppShell`; do not import `OverviewPage` inside the client shell. Preserve headings, accessible labels, mobile order, and all current text.

**Verify**: `rg '^"use client"' src/features/overview` → no output; `pnpm test:e2e` → desktop and mobile tests pass.

### Step 4: Remove the legacy aggregate

Delete `src/components/app-shell-block.tsx` only after all imports are migrated.

**Verify**: `rg "app-shell-block|AppShellBlock" src tests` → no matches; `pnpm check && pnpm test:e2e` → exit 0.

## Test plan

Reuse the behavior tests from plan 002. Add or retain assertions for summary metrics, command palette focus/close, desktop sidebar collapse, mobile sidebar sheet, and absence of horizontal overflow. Do not use screenshots as the sole assertion.

## Done criteria

- [ ] The legacy 371-line aggregate is removed.
- [ ] Overview presentation has no client directive.
- [ ] AppShell receives page content through `children`.
- [ ] Fixtures are isolated and not exported as domain contracts.
- [ ] shadcn primitive files are unchanged.
- [ ] `pnpm check` and `pnpm test:e2e` exit 0.

## STOP conditions

- Plan 006 introduced a real overview query shape that conflicts with fixtures; report and re-plan around that contract.
- Preserving behavior requires modifying generated shadcn primitives.
- The server/client composition causes a Next.js restriction not covered by current installed documentation; read `node_modules/next/dist/docs/` and stop if the target shape is invalid.

## Maintenance notes

When real overview data lands, replace only `overview-fixtures.ts` at the page/server boundary. Keep domain/application types independent from card presentation models and keep browser-only state inside focused client islands.

