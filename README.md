# Open Local Prospector

Open Local Prospector is a local-first application for finding independent businesses whose public online presence suggests a meaningful website opportunity. Poland is the initial focus. The application is designed for one local user and performs no outreach.

The repository currently contains the product specification, architecture decisions, a responsive shadcn/7Ovr UI spike, the first Search Brief and Prospecting Run module, a separate worker composition root, and verification tooling. Brave Search discovery, SQLite durability, browser inspection, and provider runtime adapters remain planned MVP work.

## Requirements

- Node.js 22 or newer
- pnpm 10.32.1, enabled through Corepack or installed directly
- Chromium for end-to-end tests: `pnpm exec playwright install chromium`

Docker, PostgreSQL, and usage-based AI credentials are not required.

## Local development

```powershell
pnpm install
pnpm dev
```

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

`pnpm setup`, SQLite migrations, Playwright website inspection, Brave Search configuration, and Codex/Claude/OpenCode runtime readiness are specified but not implemented yet. Do not treat PRD acceptance criteria as current behavior.

## License

[MIT](LICENSE). Users remain responsible for provider subscription terms, public-source terms, privacy obligations, and applicable outreach law.
