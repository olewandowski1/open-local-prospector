# Plan 001: Enforce The Loopback API Boundary

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving to the next step. If a STOP condition occurs, report it
> rather than improvising. When done, update Plan 001 in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b060b46..HEAD -- src/proxy.ts src/features/workspace-administration/server/workspace-services.ts src/app/api`
> If an in-scope file changed, compare the current-state excerpts below with the live code before
> proceeding.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `b060b46`, 2026-08-23

## Why This Matters

Binding Next.js to `127.0.0.1` does not by itself prove that an HTTP request came from the local UI.
The current origin helper accepts a missing Origin and accepts any hostname when Origin and Host
match. Sensitive reads are not guarded, and several state-changing routes omit the helper entirely.
The completed change must reject DNS-rebinding hostnames, protect backup/export responses, and apply
one consistent mutation policy without introducing accounts or remote authentication.

## Current State

- `src/features/workspace-administration/server/workspace-services.ts:43-60` compares
  `originUrl.host` to `Host`, but never requires the documented loopback host.
- `src/app/api/workspace/backup/route.ts:9-25` returns the complete workspace with no request
  admission check.
- `src/app/api/export/route.ts:5-23` returns candidate/contact data with no admission check.
- `src/app/api/runtimes/[runtimeId]/update/route.ts:6-13` accepts a bodyless POST and launches the
  selected provider CLI's fixed `update` command without an origin check.
- Workspace reset, restore, cleanup, compact, run deletion, business deletion, and suppression
  removal already call `assertSameOrigin`; preserve their confirmation checks.
- Next.js 16 uses `src/proxy.ts`, not deprecated `middleware.ts`. The local guide is
  `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.

Current guard shape:

```ts
// src/features/workspace-administration/server/workspace-services.ts:43
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin")
  if (!origin) return
  const requestHost = request.headers.get("host")
  // ...accepts when originUrl.host === requestHost
}
```

Relevant constraints:

- Product and README bind the web server to literal `127.0.0.1`; do not add remote access.
- The application remains account-free and local-first. This is request admission, not AuthN/AuthZ.
- Error text must echo a verified state and must not expose internal stack details.
- Cross-feature imports must use public feature interfaces.

## Commands You Will Need

| Purpose | Command | Expected On Success |
|---|---|---|
| Focused tests | `pnpm test -- workspace-services proxy` | all matching tests pass |
| Architecture | `pnpm check:architecture` | exit 0, no violations |
| Typecheck | `pnpm typecheck` | exit 0, no errors |
| Full gate | `pnpm check` | exit 0 |
| Browser suite | `pnpm test:e2e` | all configured non-skipped tests pass |
| Workspace suite | `pnpm test:e2e:workspace` | one isolated destructive flow passes |

## Scope

**In scope**:

- `src/proxy.ts` (create)
- `src/proxy.test.ts` (create)
- `src/features/workspace-administration/server/workspace-services.ts`
- `src/features/workspace-administration/server/workspace-services.test.ts`
- State-changing route handlers under `src/app/api/` that currently lack `assertSameOrigin`
- `CHANGELOG.md`

**Out of scope**:

- Accounts, sessions, API keys, remote access, TLS termination, or cloud deployment
- Provider command arguments or runtime update interpretation
- Browser destination policy (separate backlog finding)
- Any weakening of existing typed DELETE/RESET/RESTORE/CLEANUP confirmations
- CORS enablement for foreign origins

## Git Workflow

- Branch: `advisor/001-loopback-api-boundary`
- Use Conventional Commits; expected final message: `fix: enforce the loopback API boundary`
- Preserve unrelated work. Do not push unless the operator asks.

## Steps

### Step 1: Characterize The Admission Contract

Extend `workspace-services.test.ts` or create a pure admission-policy test module covering:

1. Literal `127.0.0.1` with the actual request port is accepted.
2. `Origin` matching an attacker hostname and `Host` matching that same attacker hostname is rejected.
3. Foreign Origin against `127.0.0.1` is rejected.
4. Malformed Origin is rejected.
5. A non-browser local request with no Origin remains accepted only when Host is the literal allowed
   loopback host.
6. IPv6/localhost aliases are not accepted unless the product is explicitly changed to bind them.

Do not infer acceptance from `request.url`; validate the incoming Host because DNS rebinding controls
that header from the browser's origin.

**Verify**: `pnpm test -- workspace-services` -> the new hostile-host case fails against old code and
all existing cases remain understood.

### Step 2: Add A Central Next.js 16 API Proxy

Create `src/proxy.ts` with a constant matcher for `/api/:path*`. Reuse a pure local-request admission
function rather than duplicating parsing. Return a small JSON error response with status 403 when
Host is not the documented loopback host; otherwise continue with `NextResponse.next()`.

Test the matcher and response using `next/experimental/testing/server`, following the Next.js 16
proxy guide. Include backup and export URLs in the matcher tests.

**Verify**: `pnpm test -- proxy` -> all proxy tests pass, including an attacker hostname rejected
before a route handler runs.

### Step 3: Protect Every Mutation From Cross-Origin Browser Requests

Inventory every `POST`, `PUT`, `PATCH`, and `DELETE` export under `src/app/api`. Add the existing,
strengthened `assertSameOrigin(request)` call at the start of mutation routes that lack it, including:

- Prospecting Run creation and preflight mutation boundaries
- Review/correction and suppression
- Run control
- Runtime update

Keep body validation and confirmation checks in their existing order after admission. Do not add the
guard to pure helper functions where no Request exists.

**Verify**: `rg -L "assertSameOrigin" src/app/api -g route.ts` -> manually inspect every remaining
file and confirm it exports only GET/HEAD or is intentionally handled solely by `src/proxy.ts`.

### Step 4: Run Full Verification And Record The Change

Add an Unreleased security/fix entry to `CHANGELOG.md` stating that API traffic now enforces the
literal loopback host and all state-changing routes reject foreign browser origins.

**Verify**: `pnpm check && pnpm test:e2e && pnpm test:e2e:workspace` -> all exit 0.

## Test Plan

- Pure admission tests: literal loopback, port handling, missing Origin, malformed Origin, foreign
  Origin, attacker Host plus matching attacker Origin.
- Proxy tests: matcher includes every `/api` path and excludes normal page/assets; hostile host gets
  403; valid local host continues.
- Route tests: at least runtime update and one JSON mutation reject a foreign Origin before invoking
  the underlying service.
- Keep the isolated backup/restore flow green to prove valid local browser traffic still works.

## Done Criteria

- [ ] Every `/api` request passes through `src/proxy.ts` host admission.
- [ ] Every state-changing route rejects a foreign browser Origin.
- [ ] Matching attacker Origin and Host are rejected.
- [ ] Backup and export remain downloadable from `http://127.0.0.1:<configured port>`.
- [ ] Existing confirmation phrases remain required.
- [ ] `pnpm check`, `pnpm test:e2e`, and `pnpm test:e2e:workspace` exit 0.
- [ ] Only in-scope files and `plans/README.md` are modified.

## STOP Conditions

- Next.js 16 proxy behavior in the installed docs differs from the assumptions above.
- Supporting a host other than literal `127.0.0.1` is required by a product/ADR decision.
- A central proxy cannot run in the Node.js host-native deployment used by this repository.
- Tests require weakening the hostile-host case or existing destructive confirmations.

## Maintenance Notes

Any future API route is automatically covered by the proxy's `/api/:path*` matcher, but new mutation
handlers must still apply the Origin policy so simple cross-site POSTs fail explicitly. Review any
future change to bind addresses or ports together with this policy and the Product/Architecture docs.

