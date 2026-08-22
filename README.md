<h1 align="center">Open Local Prospector</h1>

<p align="center">
  Find independent businesses whose public online presence shows a real website opportunity —
  entirely on your own machine.
</p>

<p align="center">
  <a href="https://github.com/olewandowski1/open-local-prospector/actions/workflows/check.yml"><img alt="Checks" src="https://img.shields.io/github/actions/workflow/status/olewandowski1/open-local-prospector/check.yml?branch=main&label=checks&style=flat-square"></a>
  <a href="LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/licence-MIT-blue?style=flat-square"></a>
  <img alt="Node 22+" src="https://img.shields.io/badge/node-%E2%89%A522-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white">
  <img alt="Next.js 16" src="https://img.shields.io/badge/next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white">
  <img alt="No API keys required" src="https://img.shields.io/badge/API%20keys-none%20required-success?style=flat-square">
</p>

---

## What this is

Lead lists tell you that a business exists. They do not tell you **why** its website is costing it
enquiries, and they happily mix in chains, franchises, and businesses whose website decisions are
made three cities away.

Open Local Prospector is a single-user, local-first web application that does the tedious part
itself: it searches for businesses in a place and category you choose, works out which website
actually belongs to each one, opens that website in a real browser, and ranks what it finds by an
explainable score — every claim tied to a source URL you can click.

It runs on your machine, keeps everything in one SQLite file, and **sends no outreach**. What you do
with a shortlist afterwards is your business, not the application's.

## What makes it different

| | |
|---|---|
| **No API keys, no credits** | Discovery uses the web-search capability of the Codex or Claude CLI you are already signed in to. There is no search API to register for, and no usage-based fallback that could quietly start spending. |
| **Evidence, not opinions** | Every website opportunity cites at least one Supporting Observation with a source URL and a timestamp. A claim with nothing behind it is treated as a bug. |
| **The application is in charge** | The AI runtime classifies and explains. The application owns search, browsing, validation, scoring, retries, limits, and persistence — see [ADR 0002](docs/adr/0002-application-owned-agent-orchestration.md). |
| **Deterministic scoring** | The 0–100 Opportunity Score is calculated by versioned application code from structured fields, not asked for from a model. Every score records the rubric version that produced it. |
| **Untrusted by construction** | Web pages are evidence, never instructions. The inspector blocks private networks, unsafe protocols, downloads, pop-ups and unexpected navigation, and records authentication walls and CAPTCHAs rather than trying to get past them. |
| **Resumable** | Every stage checkpoints into SQLite. Kill the worker mid-run and it resumes from committed work rather than from the beginning. |
| **Local by default** | Loopback-only web server, one SQLite file, artifacts on disk. No account, no telemetry, no crash reporting. |

## How a run works

```text
Search Brief          you pick a place, a category, a target of 5-50, a depth, a runtime
      |
      v
Run Preflight         database, browser, disk, runtime authentication, workload estimate
      |
      v
  +------------------- background worker, checkpointed in SQLite --------------------+
  |                                                                                  |
  |  Discover  ->  Deduplicate  ->  Corroborate  ->  Inspect  ->  Assess  ->  Score  |
  |  runtime       canonical       name, address    Playwright   schema-      app    |
  |  web search    business        phone, links     desktop      constrained  code   |
  |                                                 and mobile                       |
  |                                                                                  |
  +----------------------------------------------------------------------------------+
      |
      v
Review Queue          ranked candidates, score breakdown, screenshots, sources, contact routes
      |
      v
Your decision         shortlist, reject with a reason, correct the record, export CSV or JSON
```

A run ends in one stated outcome — Target Reached, Search Exhausted, Cancelled with Partial Results,
Paused, Runtime Unavailable, Completed with Warnings, or Infrastructure Failed — and one failed
business never fails the whole run.

## What it deliberately does not do

Knowing the edges matters as much as knowing the features.

- No outreach. It does not send, schedule, or draft email, calls, forms, or messages.
- No CRM, no pipeline automation, no recurring runs, no monitoring.
- No CAPTCHA solving, no authentication bypass, no scraping of consumer search-result pages.
- No paid datasets, no private account data, no named-person enrichment.
- No cloud, no multi-user, no remote access, no application account.
- No automatic tuning of prompts, weights, or thresholds from your review decisions.

## Requirements

- **Node.js 22 or newer**
- **pnpm 10.32.1**, through Corepack or a direct install
- **At least one authenticated CLI**, signed in through its own terminal flow:
  - Codex — `npm install -g @openai/codex`, then `codex login`
  - Claude — `irm https://claude.ai/install.ps1 | iex` on Windows, or
    `curl -fsSL https://claude.ai/install.sh | bash`, then `claude auth login`
  - OpenCode — `npm install -g opencode-ai`. No login needed: its hosted catalog answers without
    one, and a provider login only adds more models (`opencode providers login`).

No Docker. No PostgreSQL. No search API key. No Python or C++ toolchain — `better-sqlite3` installs
from its prebuilt binaries.

The application never performs provider login, and never reads, copies, or stores provider
credentials. It only reports what each official client says about itself.

## Quick start

```powershell
pnpm install
pnpm run setup
pnpm run app
```

Then open <http://127.0.0.1:4310>.

`pnpm run setup` creates or migrates the SQLite database, prepares artifact storage, copies the
non-secret `.env.local.example` template if you have no `.env.local`, and installs the matching
Playwright Chromium build. It is safe to run again at any time. Use the explicit `run`: `pnpm setup`
is a reserved pnpm command and will not invoke this script.

`pnpm run app` runs setup, produces a production build, and starts the web process and the worker
together. Once a build exists, `pnpm start` goes straight to running both.

> Run every command from the repository root. Database and artifact paths resolve against the
> current working directory, so starting elsewhere quietly creates an empty workspace instead of
> reporting an error.

## Using it versus changing it

| Command | For |
|---|---|
| `pnpm run app` | Using the application: setup, production build, web and worker. |
| `pnpm start` | The same, from an existing build. |
| `pnpm dev` | Changing the application: Next dev server plus a watching worker. |
| `pnpm start:web`, `pnpm start:worker` | One process at a time. |

Both `pnpm dev` and `pnpm start` bind `127.0.0.1:4310`, so only one can run at a time; the second
reports `EADDRINUSE`. The build lives in the ignored `.next/` directory, so it belongs to the
machine rather than to the repository — rebuild after pulling.

The development worker reloads on save. The production worker does not, so a stray save cannot
restart a worker in the middle of a run.

## Configuration

Everything here is optional and non-secret. Copy `.env.local.example` to `.env.local` to change it.

| Variable | Default | Purpose |
|---|---|---|
| `PROSPECTOR_DATABASE_PATH` | `.local/open-local-prospector.sqlite` | SQLite file |
| `PROSPECTOR_ARTIFACTS_PATH` | `.local/artifacts` | Screenshots and page evidence |
| `PROSPECTOR_BUSINESS_CONCURRENCY` | `2` | Concurrent inspections, 1 through 4 |
| `PROSPECTOR_GEOCODER_URL` | Nominatim `/search` | Any compatible geocoding endpoint |
| `PROSPECTOR_CODEX_EXECUTABLE` | resolved from `PATH` | Absolute path to the Codex CLI |
| `PROSPECTOR_CLAUDE_EXECUTABLE` | resolved from `PATH` | Absolute path to the Claude CLI |
| `PROSPECTOR_OPENCODE_EXECUTABLE` | resolved from `PATH` | Absolute path to the OpenCode CLI |

`.local/` is git-ignored. If you override a path, set it in the terminal that runs setup as well.

Search Area interpretation uses the public OpenStreetMap Nominatim endpoint by default. It is
triggered only by an explicit action — never autocomplete — limited to one request per second,
cached locally for seven days, and identified with an application User-Agent. Please read the
[Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) before leaning on
it, and point `PROSPECTOR_GEOCODER_URL` elsewhere if you need to.

## How it is built

```text
src/app/                  Next.js routes and composition
src/components/           app shell, shared components, generated shadcn primitives
src/features/<feature>/   domain, application, infrastructure, server, presentation
src/worker/               independent worker composition root
src/test-support/         unit fixtures and e2e helpers
tests/e2e/                cross-feature browser flows
```

A feature owns its own layers and exposes a narrow public interface; cross-feature imports go
through it, and `pnpm check:architecture` enforces that. Next.js and React stay conventional;
[Effect](https://effect.website) is used inside the worker and the server domain for typed errors,
scoped resources, bounded concurrency and schema validation. SQLite — not Effect — remains the
source of truth for anything that has to survive a restart.

Persistence is Drizzle over `better-sqlite3` in WAL mode. Migrations live in `drizzle/` and are
applied by setup. The interface is Tailwind CSS with shadcn/ui on Base UI primitives, and Hugeicons
throughout.

## Verification

```powershell
pnpm check          # Biome, feature boundaries, TypeScript, unit tests, production build
pnpm test:e2e       # Chromium desktop and mobile flows
pnpm worker:check   # the worker composition root, on its own
```

Unit tests sit beside the code they exercise as `*.test.ts` or `*.test.tsx`. Cross-feature browser
flows live in `tests/e2e`. Biome owns formatting and linting (`pnpm format`, `pnpm check:biome`),
and Lefthook runs it over staged files before a commit, then typecheck and unit tests before a push.

## Documentation

| Document | What it settles |
|---|---|
| [CONTEXT.md](CONTEXT.md) | The domain language. Names here are the names used in code and in the interface. |
| [AGENTS.md](AGENTS.md) | Working agreements, design rules, and engineering guards. |
| [docs/PRD.md](docs/PRD.md) | Product requirements and user stories. |
| [docs/adr/](docs/adr) | Architecture decisions, with the reasoning kept. |
| [docs/MVP-QUALITY-GATE.md](docs/MVP-QUALITY-GATE.md) | What the MVP had to satisfy. |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to propose a change. |

## Responsible use

This tool reads publicly accessible pages and helps you form a judgement about them. It contacts
nobody. You remain responsible for your provider's subscription terms, the terms of the sources you
read, applicable privacy law, and any outreach law that applies where you and the business are.
Suppression entries exist so that a request not to be contacted is honoured across every run and
every export — use them.

## Licence

[MIT](LICENSE).
