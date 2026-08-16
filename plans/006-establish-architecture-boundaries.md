# Plan 006: Establish domain, application, infrastructure, and worker boundaries

> **Executor instructions**: This is a foundation plan, not permission to build the full prospecting pipeline. Preserve every ADR decision, implement only the narrow Search Brief slice described here, and update the index when done.
>
> **Drift check (run first)**: `git diff --stat <BASELINE_SHA>..HEAD -- package.json pnpm-lock.yaml src tests eslint.config.mjs tsconfig.json` using the root SHA from plan 001. STOP if another domain/worker architecture has appeared.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans 001–003
- **Category**: tech-debt
- **Planned at**: root baseline created by plan 001, plan authored 2026-08-16

## Why this matters

The next product work spans HTTP, durable jobs, SQLite, browser inspection, and provider subprocesses. Without explicit seams, Next.js request code can become the orchestrator and UI-shaped data can become persistence contracts. This plan proves the intended dependency direction using one bounded Search Brief contract and an independently startable worker, without implementing discovery.

## Current state

- `src/app/page.tsx:1-5` renders only `AppShellBlock`.
- There are no `domain`, `application`, `infrastructure`, `server`, or `worker` modules.
- `docs/PRD.md:272-287` requires separate web and Effect-powered worker processes; SQLite is durable truth and React stays conventional.
- ADR 0002 says the application owns orchestration; ADR 0007 requires resumable bounded jobs; ADR 0010 puts Effect only in worker/server-domain execution.
- Domain vocabulary must use `SearchBrief`, `ProspectingRun`, and `CandidateBusiness`; do not introduce “lead”, “crawl”, or “agent thoughts” models (`CONTEXT.md`).

## Target dependency direction

```text
src/domain              imports no framework, storage, browser, or process APIs
src/application         imports domain; declares ports and use cases
src/infrastructure      implements application ports; may import Effect/SQLite/etc.
src/server              composes application + infrastructure for Next route handlers
src/worker              independent Node composition root; never imports src/app
src/app                 HTTP/UI adapter; imports server facade and presentation modules
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Full verification | `pnpm check` | exit 0 |
| Worker check | `pnpm worker:check` | starts, reports no claimable work, exits 0 in check mode |
| Boundary scan | `pnpm test -- architecture` | prohibited imports produce zero failures |

## Scope

**In scope**: `package.json`, `pnpm-lock.yaml`, targeted lint/test config, and new files under `src/domain/`, `src/application/`, `src/infrastructure/`, `src/server/`, `src/worker/`, plus their tests. A minimal `src/app/api/prospecting-runs/route.ts` may be created only to exercise the use-case boundary.

**Out of scope**: Brave Search calls, Playwright browsing, provider CLI spawning, real opportunity scoring, UI data fetching, full database schema, outreach, Docker, PostgreSQL, Effect workflow/cluster APIs.

## Git workflow

- Branch `advisor/006-architecture-boundaries`; use logical commits: domain contract, application port/use case, infrastructure/worker composition, tests.
- Conventional messages such as `feat: add search brief application boundary`.

## Steps

### Step 1: Add and pin only foundation dependencies

Use exact stable Effect v3 packages required for Schema and Node execution. Do not add Effect v4/beta. Add no database/browser/provider dependency unless a file in this plan uses it. Keep all tooling in dev dependencies.

**Verify**: `pnpm list effect --depth 0` → one stable 3.x version; `pnpm check` → exit 0.

### Step 2: Define the pure Search Brief contract

Create `src/domain/search-brief.ts` with an Effect Schema and inferred type for: non-empty location, optional non-negative radius, one non-empty predefined/custom category, target integer 5–50, `Quick | Thorough`, and selected runtime identifier. Export a constructor/parser that returns typed validation failures rather than throwing unknown values. It must import no React, Next.js, Node process APIs, persistence, or browser modules.

**Verify**: domain tests cover boundaries 4/5/50/51, blank location/category, optional radius, and both modes; `pnpm test -- search-brief` → all pass.

### Step 3: Define application ports and one use case

Create an application-owned `ProspectingRunRepository` port and `StartProspectingRun` use case. The use case validates a Search Brief and asks the repository to create a pending run; it does not know SQLite, HTTP, or UI shapes. Use typed domain/application errors and Effect services/Layers consistently with ADR 0010.

**Verify**: in-memory repository tests prove one valid pending run is created and invalid input creates none.

### Step 4: Prove both composition roots

Create a thin Next Route Handler that parses JSON, invokes the provided server Effect once, and maps typed validation errors to 400 without returning internal details. Create `src/worker/main.ts` as a separate Node entry that builds its Layer and supports a non-mutating `--check` mode. Add `worker:check`; do not make a forever-running placeholder.

**Verify**: Route tests cover valid/invalid input; `pnpm worker:check` exits 0 without importing Next or writing data.

### Step 5: Enforce dependency boundaries

Add an architecture test or lint rules that fail when domain imports framework/infrastructure modules, application imports UI/Next, or worker imports `src/app`. Prefer a small deterministic import-boundary test over a large new dependency.

**Verify**: deliberately demonstrate the rule catches one temporary prohibited import, remove it, then `pnpm test -- architecture` passes.

## Test plan

- Domain boundary and validation cases.
- Application use case with in-memory port implementation.
- Route validation/error mapping without real network services.
- Worker `--check` composition.
- Dependency-direction regression test.

## Done criteria

- [ ] Target directories contain used code, not empty placeholders or barrel-file mazes.
- [ ] Search Brief constraints match PRD Story 2.
- [ ] No domain/application module imports Next, React, Playwright, SQLite, or child processes.
- [ ] Web and worker each have one explicit Effect execution boundary.
- [ ] `pnpm check`, focused tests, and `pnpm worker:check` exit 0.
- [ ] No out-of-scope integration was implemented.

## STOP conditions

- Effect v3 APIs cannot support the documented Schema/Layer pattern without deprecated interfaces.
- Another architecture or persistence implementation landed after planning.
- The thin slice requires inventing run states inconsistent with `CONTEXT.md` or ADR 0007.
- A step needs real credentials, browser installation, or external network access.

## Maintenance notes

Future SQLite, Brave, Playwright, and runtime adapters belong in infrastructure and are provided through application ports. SQLite—not Effect fibers—is the future durable workflow source of truth. Avoid generic `utils`, global service locators, and provider-specific types in domain/application layers.

