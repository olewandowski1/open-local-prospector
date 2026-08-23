<p align="center">
  <img src="docs/assets/logo.svg" alt="Open Prospector Radar Logo" width="96" height="96">
</p>

<h1 align="center">Open Prospector</h1>

<p align="center">
  Find independent businesses whose public online presence shows a real website opportunity.
  Work on your own machine, with evidence you can inspect.
</p>

<p align="center">
  <a href="https://github.com/olewandowski1/open-local-prospector/actions/workflows/check.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/olewandowski1/open-local-prospector/check.yml?branch=main&label=CI&style=flat-square"></a>
  <a href="LICENSE"><img alt="MIT Licence" src="https://img.shields.io/badge/Licence-MIT-blue?style=flat-square"></a>
  <img alt="Node 22 Or Newer" src="https://img.shields.io/badge/Node-%E2%89%A522-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white">
  <img alt="API Keys: None Required" src="https://img.shields.io/badge/API%20Keys-None%20Required-success?style=flat-square">
</p>

![Open Prospector Overview With Synthetic Businesses](docs/assets/overview.png)

## What It Does

Lead lists tell you that a business exists. They rarely explain whether the business has a genuine
Website Opportunity, and they happily mix independent businesses with chains whose website
decisions are made elsewhere.

Open Prospector handles the research loop: it searches a place and category you choose,
corroborates which public presence belongs to each business, inspects websites in a controlled
browser, and ranks evidence-backed opportunities. Every material claim points to a source URL you
can open yourself.

The application runs locally, keeps durable work in SQLite, and sends no outreach.

## Why It Is Different

| Principle | What It Means |
|---|---|
| No API Keys Or Credits | Discovery uses an installed Codex, Claude, or OpenCode runtime. There is no metered fallback. |
| Evidence Before Opinion | Every Website Opportunity includes a Supporting Observation, source URL, and observation time. |
| Application-Owned Control | The application owns search bounds, browsing, validation, scoring, retries, persistence, and safety. |
| Deterministic Scoring | Versioned application code calculates the 0–100 Opportunity Score from structured evidence. |
| Untrusted By Construction | Web content is evidence, never instruction. Unsafe navigation and private networks are blocked. |
| Resumable Work | Every stage checkpoints to SQLite so interrupted runs continue from committed work. |
| Local By Default | The server binds to loopback; there is no account, telemetry, cloud service, or remote access. |

## How A Run Works

```text
Search Brief          place, category, target, Run Mode, runtime
      │
      ▼
Run Preflight         storage, browser, runtime, Search Area, workload
      │
      ▼
┌────────────────────── background worker ──────────────────────┐
│ Discover → Deduplicate → Corroborate → Inspect → Assess → Score │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
Candidates            evidence, score, screenshots, sources, contact routes
      │
      ▼
Your Decision         shortlist, reject, correct, suppress, or export
```

A run ends in one recorded outcome: Target Reached, Search Exhausted, Cancelled With Partial
Results, Paused, Runtime Unavailable, Completed With Warnings, or Infrastructure Failed. One failed
business never fails the whole run.

![Candidate Review With Synthetic Evidence](docs/assets/candidate-review.png)

## Product Boundaries

- No email, calls, forms, messages, outreach drafts, or scheduling.
- No CRM, pipeline automation, recurring runs, or monitoring.
- No CAPTCHA solving, authentication bypass, or consumer search-result scraping.
- No paid datasets, named-person enrichment, or private account data.
- No cloud, multi-user workspace, telemetry, or remote access.
- No automatic tuning of prompts, weights, or thresholds from review decisions.

## Requirements

- Node.js 22 or newer.
- pnpm 10 or newer, through Corepack or a direct installation.
- At least one ready runtime:
  - Codex: `npm install -g @openai/codex`, then `codex login`.
  - Claude: install the official client, then `claude auth login`.
  - OpenCode: `npm install -g opencode-ai`; provider login is optional.

No Docker, PostgreSQL, search API key, Python, or C++ toolchain is required.

The application never performs provider login and never reads, copies, or stores provider
credentials. It only reports what each installed client says about its own readiness.

## Quick Start

```powershell
pnpm install
pnpm run setup
pnpm run app
```

Open <http://127.0.0.1:4310>.

`pnpm run setup` creates or migrates the database, prepares artifact storage, copies the non-secret
environment template when needed, and installs the matching Playwright Chromium build. It is safe
to run repeatedly. Use the explicit `run`: `pnpm setup` is a reserved pnpm command.

Run commands from the repository root. Database and artifact paths resolve against the current
working directory.

## Commands

| Command | Purpose |
|---|---|
| `pnpm run app` | Set up, build, and run the production web process and worker |
| `pnpm start` | Run both processes from an existing production build |
| `pnpm dev` | Run the development server and watching worker |
| `pnpm check` | Run the repository verification gate |
| `pnpm test:e2e` | Run synthetic desktop and mobile browser flows |
| `pnpm test:e2e:workspace` | Run destructive workspace round trips in isolation |
| `pnpm test:e2e:live` | Run explicitly enabled real-runtime checks |
| `pnpm docs:screenshots` | Rebuild documentation images from synthetic fixture data |

Both development and production bind `127.0.0.1:4310`, so only one can run at a time. The
development worker reloads on save; the production worker does not.

## Configuration

Every setting is optional and non-secret. Copy `.env.local.example` to `.env.local` to override a
default.

| Variable | Default | Purpose |
|---|---|---|
| `PROSPECTOR_DATABASE_PATH` | `.local/open-local-prospector.sqlite` | SQLite workspace |
| `PROSPECTOR_ARTIFACTS_PATH` | `.local/artifacts` | Screenshots and page evidence |
| `PROSPECTOR_BUSINESS_CONCURRENCY` | `2` | Concurrent inspections, from 1 to 4 |
| `PROSPECTOR_GEOCODER_URL` | Nominatim `/search` | Compatible geocoding endpoint |
| `PROSPECTOR_CODEX_EXECUTABLE` | Resolved from `PATH` | Codex executable |
| `PROSPECTOR_CLAUDE_EXECUTABLE` | Resolved from `PATH` | Claude executable |
| `PROSPECTOR_OPENCODE_EXECUTABLE` | Resolved from `PATH` | OpenCode executable |

Search Area interpretation uses OpenStreetMap Nominatim by default. It runs only after an explicit
action, is limited to one request per second, caches results locally for seven days, and identifies
the application with a User-Agent. Review the
[Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) before sustained
use.

## Architecture

```text
src/app/                  Next.js routes and composition
src/components/           Application shell and shared shadcn primitives
src/features/<feature>/   Feature-owned layers and public interfaces
src/worker/               Independent worker composition root
src/test-support/         Synthetic fixtures and test helpers
tests/e2e/                App, live, workspace, and documentation browser flows
```

Features expose narrow public interfaces, and `pnpm check:architecture` enforces their boundaries.
Persistence uses Drizzle over `better-sqlite3` in WAL mode. Effect manages typed worker execution,
bounded concurrency, timeouts, and resource lifetimes while SQLite remains the durable source of
truth. The interface uses Tailwind CSS, shadcn/ui on Base UI, and Hugeicons.

Read [Architecture](docs/Architecture.md) for the system shape and the
[Architecture Decision Records](docs/adr/) for the reasoning behind it.

## Verification

```powershell
pnpm check
pnpm worker:check
pnpm test:e2e
pnpm test:e2e:workspace
```

Unit tests are colocated with source as `*.test.ts` or `*.test.tsx`. Cross-feature browser flows are
grouped under `tests/e2e`. Biome owns formatting and linting, while Lefthook runs fast checks before
commits and pushes.

## Documentation

| Document | Purpose |
|---|---|
| [Documentation Index](docs/README.md) | Entry point for maintained project documents |
| [Product Requirements](docs/Product.md) | Product boundary, user journeys, and measurable requirements |
| [Domain Language](docs/Domain-Language.md) | Canonical product vocabulary |
| [Architecture](docs/Architecture.md) | Current system, source, and trust boundaries |
| [Agent Instructions](AGENTS.md) | Design rules and engineering guards |
| [Contributing](CONTRIBUTING.md) | Setup and contribution workflow |

## Responsible Use

This application reads public pages and helps one user form a judgement. It contacts nobody. The
user remains responsible for provider terms, source terms, privacy law, and any outreach law that
applies. Suppression Entries exist so that a request not to be contacted is honored across every run
and export.

## Licence

[MIT](LICENSE)
