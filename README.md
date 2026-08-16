# Open Local Prospector

Open Local Prospector is a local-first application for finding independent businesses whose public online presence suggests a meaningful website opportunity. Poland is the initial focus. The application is designed for one local user and performs no outreach.

The repository contains the product specification, architecture decisions, a responsive shadcn/7Ovr UI spike, the first Search Brief and Prospecting Run module, durable local SQLite setup, dependency readiness diagnostics, a separate worker composition root, and verification tooling. Brave Search discovery, website inspection, and provider runtime adapters remain planned MVP work.

## Requirements

- Node.js 22 or newer
- pnpm 10.32.1, enabled through Corepack or installed directly

Docker, PostgreSQL, and usage-based AI credentials are not required.

## Local development

```powershell
pnpm install
pnpm run setup
pnpm dev
```

`pnpm run setup` creates or migrates the local SQLite database, prepares artifact storage, copies the non-secret `.env.local.example` template when needed, and installs the compatible Playwright Chromium build. It is safe to run repeatedly. Use the explicit `run`: `pnpm setup` is a reserved pnpm command and does not invoke project scripts.

Local state is stored under `.local/` by default and is ignored by Git. Set `PROSPECTOR_DATABASE_PATH` or `PROSPECTOR_ARTIFACTS_PATH` in the terminal running setup when an override is needed, and mirror that non-secret path in `.env.local` for the web application. Add `BRAVE_SEARCH_API_KEY` only to `.env.local` to make Brave Search configuration ready; setup never reads it and its value remains server-side.

The Next.js server binds to `127.0.0.1:4310` by default. It is intentionally not exposed to the local network.

## Verification

```powershell
pnpm check          # Biome, TypeScript, unit tests, production build
pnpm test:e2e       # Chromium desktop and mobile flows
pnpm worker:check   # independent worker composition root
```

Unit tests are colocated with source as `*.test.ts` or `*.test.tsx`. Cross-feature browser flows live in `tests/e2e`.

Biome owns formatting and linting:

```powershell
pnpm format
pnpm check:biome
```

Lefthook runs Biome on staged files before commits and typecheck/unit tests before pushes.

## UI workflow

The UI uses Tailwind CSS, shadcn/ui with Base UI primitives, and selected 7Ovr registry blocks. 7Ovr is an accelerator rather than a second component system; installed blocks must be reviewed and adapted to canonical shadcn composition.

Project-scoped shadcn MCP configuration is available for Codex, Claude Code, and OpenCode. It executes the lockfile-pinned CLI:

```powershell
pnpm exec shadcn mcp
```

Restart the coding client after changing MCP configuration. Claude Code requires one-time project approval.

## Source architecture

```text
src/app/                         Next.js routes and composition
src/components/app-shell/        shared Local Application shell
src/components/ui/               generated shadcn primitives
src/features/<feature>/          feature-owned implementation and colocated tests
src/worker/                      independent worker composition root
tests/e2e/                       cross-feature browser flows
```

A feature owns its domain rules, application execution, adapters, server integration, and presentation when those concerns exist. Internal folders are added only when they hide real complexity.

## Product and architecture documents

- [Domain language](CONTEXT.md)
- [Product requirements](docs/PRD.md)
- [Architecture decisions](docs/adr)
- [Implementation plans](plans/README.md)

Playwright website inspection, Brave Search discovery, and Codex/Claude/OpenCode runtime readiness are specified but not implemented yet. Do not treat remaining PRD acceptance criteria as current behavior.

## License

[MIT](LICENSE). Users remain responsible for provider subscription terms, public-source terms, privacy obligations, and applicable outreach law.
