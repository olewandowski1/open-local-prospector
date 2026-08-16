# Plan 004: Make shadcn MCP execution reproducible

> **Executor instructions**: Execute and verify each step, then update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat <BASELINE_SHA>..HEAD -- package.json pnpm-lock.yaml .codex/config.toml .mcp.json opencode.json` using the root SHA from plan 001. STOP on incompatible MCP changes.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans 001 and 002
- **Category**: dx
- **Planned at**: root baseline created by plan 001, plan authored 2026-08-16

## Why this matters

All three MCP clients currently download `shadcn@latest`, so tool behavior can change without a lockfile or repository diff. The project already has a lockfile-managed shadcn CLI and should execute that copy.

## Current state

- `package.json:20` lists `shadcn` `^4.18.0` under production dependencies.
- `.codex/config.toml:2-3`, `.mcp.json:4-5`, and `opencode.json:5-6` use `pnpm dlx shadcn@latest mcp`.
- `components.json:24-26` configures the `@7ovr` registry; preserve it.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| CLI check | `pnpm exec shadcn mcp --help` | MCP command starts or prints help without downloading `latest` |
| Repository check | `pnpm check` | exit 0 |

## Scope

**In scope**: `package.json`, `pnpm-lock.yaml`, `.codex/config.toml`, `.mcp.json`, `opencode.json`.

**Out of scope**: registry selection, UI components, globally installed MCP configuration, provider authentication, plugin installation.

## Git workflow

- Branch `advisor/004-pin-shadcn-mcp`; commit `chore: pin project shadcn MCP`.

## Steps

### Step 1: Pin the repository CLI

Move `shadcn` to `devDependencies` and pin the currently locked compatible version exactly (no caret or tilde). Refresh the lockfile with pnpm; do not upgrade unrelated packages.

**Verify**: `pnpm list shadcn --depth 0` → one exact project version; `pnpm install --frozen-lockfile` → exit 0.

### Step 2: Use the project executable in every MCP client

Replace each command with the client-equivalent of `pnpm exec shadcn mcp`: Codex/Claude use command `pnpm` and args `["exec", "shadcn", "mcp"]`; OpenCode uses the equivalent command array.

**Verify**: parse both JSON files, run `codex mcp list`, and start a fresh Claude Code session to approve/check the project MCP. If OpenCode is absent, record its runtime check as not available; JSON validation must still pass.

### Step 3: Run repository verification

**Verify**: `pnpm check` → exit 0 and `rg "shadcn@latest|\bdlx\b" .codex/config.toml .mcp.json opencode.json` → no matches.

## Test plan

This is configuration behavior: validate syntax, the resolved local binary, and discovery by installed clients. No UI test is required.

## Done criteria

- [ ] One exact shadcn dev dependency is lockfile-managed.
- [ ] No project MCP configuration downloads `latest`.
- [ ] Codex recognizes the MCP; Claude's one-time approval state is documented in the execution report.
- [ ] `pnpm check` exits 0.

## STOP conditions

- The local CLI version cannot expose `mcp`.
- A client requires a different command shape than its current schema supports.
- Fixing it requires changing global client configuration.

## Maintenance notes

Upgrade shadcn deliberately through a reviewed dependency change; run registry/component smoke tests at the same time.

