<p align="center">
  <img src="docs/assets/logo.svg" alt="Open Prospector Radar Logo" width="96" height="96">
</p>

<h1 align="center">Open Prospector</h1>

<p align="center">
  Find evidence-backed website opportunities for independent businesses on your own machine.
</p>

<p align="center">
  <a href="https://github.com/olewandowski1/open-local-prospector/actions/workflows/check.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/olewandowski1/open-local-prospector/check.yml?branch=main&label=CI&style=flat-square"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-blue?style=flat-square"></a>
  <img alt="Node 22 Or Newer" src="https://img.shields.io/badge/Node-%E2%89%A522-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white">
  <img alt="API Keys: None Required" src="https://img.shields.io/badge/API%20Keys-None%20Required-success?style=flat-square">
</p>

![Open Prospector Overview In Dark Mode](docs/assets/overview.png)

## What It Does

Open Prospector searches a place and business category, verifies each business, inspects its public
website, and ranks genuine opportunities. Every material claim keeps its source and observation
time.

The application runs locally, stores work in SQLite, and uses an installed Codex, Claude, or
OpenCode subscription. It requires no API keys and sends no outreach.

## How A Run Works

![Open Prospector Run Workflow](docs/assets/run-workflow.svg)

![Candidate Review In Dark Mode](docs/assets/candidate-review.png)

## Core Principles

- Evidence comes before opinion.
- Application code owns search bounds, safety, scoring, retries, and persistence.
- Web content is untrusted data, never instruction.
- Runs are bounded, durable, and resumable.
- The product has no outreach, CRM, telemetry, or cloud account.

## Quick Start

Requirements: Node.js 22 or newer, pnpm 10 or newer, and a ready Codex, Claude, or OpenCode
runtime. Docker, a database server, and search API keys are not required.

```powershell
pnpm install
pnpm run setup
pnpm run app
```

Open <http://127.0.0.1:4310>. Run commands from the repository root.

## Commands

| Command | Purpose |
|---|---|
| `pnpm run app` | Set up, build, and run the web process and worker |
| `pnpm dev` | Run the development server and watching worker |
| `pnpm check` | Run the repository verification gate |
| `pnpm test:e2e` | Run synthetic desktop and mobile browser flows |
| `pnpm test:e2e:workspace` | Run destructive workspace tests in isolation |
| `pnpm docs:screenshots` | Rebuild the dark README screenshots |

## Configuration

Configuration is optional and non-secret. Copy `.env.local.example` to `.env.local` to change
workspace paths, concurrency, geocoding, or runtime executables.

## Architecture And Documentation

Next.js serves the local interface, a separate worker executes durable jobs, and SQLite stores the
workspace. Start with the [Documentation Index](docs/README.md), [Product](docs/Product.md),
[Domain Language](docs/Domain-Language.md), and [Architecture](docs/Architecture.md).

## Verification

```powershell
pnpm check
pnpm test:e2e
```

## Responsible Use

Open Prospector reads public pages and contacts nobody. You remain responsible for provider terms,
source terms, privacy law, and any outreach outside the application.

## License

[MIT](LICENSE)
