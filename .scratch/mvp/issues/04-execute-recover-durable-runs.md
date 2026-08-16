# 04 — Execute and recover durable Prospecting Runs

**What to build:** Turn a pending Prospecting Run into durable background work that survives web or worker restarts without repeating completed stages unnecessarily.

**Blocked by:** 03 — Create a confirmed Search Brief.

**Status:** ready-for-agent

- [ ] The web process and Effect-powered worker start through one documented development command while remaining separate processes.
- [ ] SQLite is the durable source of truth for Prospecting Runs, tasks, stage transitions, attempts, leases, checkpoints, versions, and structured failures.
- [ ] The worker claims work transactionally, executes outside the write transaction, and atomically commits each checkpoint or classified failure.
- [ ] Startup returns abandoned leased work to a resumable state without repeating completed stages.
- [ ] Default business concurrency is two and accepts a local configuration from one through four.
- [ ] Transient per-business failures retry at most twice; permanent failures remain visible and do not fail unrelated businesses.
- [ ] Worker execution uses one explicit Effect boundary and never imports the Next.js application adapter.
- [ ] Integration tests interrupt and restart work, proving completed checkpoints are preserved and abandoned tasks resume safely.
