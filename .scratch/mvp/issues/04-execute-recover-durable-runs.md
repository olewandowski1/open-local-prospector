# 04 — Execute and recover durable Prospecting Runs

**What to build:** Turn a pending Prospecting Run into durable background work that survives web or worker restarts without repeating completed stages unnecessarily.

**Blocked by:** 03 — Create a confirmed Search Brief.

**Status:** resolved

- [x] The web process and Effect-powered worker start through one documented development command while remaining separate processes.
- [x] SQLite is the durable source of truth for Prospecting Runs, tasks, stage transitions, attempts, leases, checkpoints, versions, and structured failures.
- [x] The worker claims work transactionally, executes outside the write transaction, and atomically commits each checkpoint or classified failure.
- [x] Startup returns abandoned leased work to a resumable state without repeating completed stages.
- [x] Default business concurrency is two and accepts a local configuration from one through four.
- [x] Transient per-business failures retry at most twice; permanent failures remain visible and do not fail unrelated businesses.
- [x] Worker execution uses one explicit Effect boundary and never imports the Next.js application adapter.
- [x] Integration tests interrupt and restart work, proving completed checkpoints are preserved and abandoned tasks resume safely.

## Answer

Implemented a generic Effect-powered durable task engine backed by SQLite. Prospecting Run creation now atomically seeds a versioned RunPlanning task; short transactions claim and lease work, execution runs after the connection/transaction closes, a scoped heartbeat renews leases, and completion or classified failure commits checkpoints, attempts, transitions, structured failure data, and Run state atomically. Planning enqueues the later discovery stage, which remains visibly Blocked until ticket 06 installs its adapter instead of being falsely marked complete.

`pnpm dev` now launches named web and worker child processes together while preserving separate runtimes; `PROSPECTOR_BUSINESS_CONCURRENCY` defaults to 2 and validates 1–4. Startup recovers only expired Leased tasks, completed checkpoints remain immutable, transient work gets at most two retries after its first attempt, and permanent per-business failures settle as Completed with Warnings without stopping unrelated work. Verified with restart/lease/retry/transaction-boundary integration tests, `pnpm check` (97 tests and production build), `pnpm worker:check`, a live dual-process launch, and `pnpm test:e2e` (14 passed, 2 expected platform skips).
