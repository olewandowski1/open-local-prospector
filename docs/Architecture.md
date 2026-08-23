# Architecture

## System Shape

Open Prospector is a host-native, single-user application with two processes and one durable
workspace. Next.js owns the interface and local HTTP boundary. An independent Effect worker claims
bounded tasks from SQLite and performs discovery, inspection, assessment, and scoring. SQLite and
the artifact directory are the only state that must survive a restart.

```text
Browser → Next.js Web Process → SQLite ← Effect Worker
                  │                         │
                  └─ Review And Control     ├─ Codex, Claude, Or OpenCode
                                            └─ Playwright Chromium
```

## Source Boundaries

```text
src/app/                  Routes and composition
src/components/           Application shell and shared primitives
src/features/<feature>/   Feature-owned layers and public interfaces
src/worker/               Independent worker composition root
src/test-support/         Shared synthetic fixtures and test helpers
tests/e2e/                Browser flows grouped by execution boundary
```

Features collaborate through narrow public entry points. Client components use a feature's client
entry point, while worker and server consumers use purpose-specific entry points. The architecture
check enforces these boundaries.

## Durable Execution

Every Prospecting Run and per-business stage checkpoints into SQLite. The worker uses short
transactions, bounded concurrency, explicit timeouts, and resumable claims. Effect manages runtime
resources and typed failures; it does not replace the database as workflow state.

## Trust Boundaries

- Subscription runtimes receive bounded stage inputs and never own application authority.
- Source Content is untrusted evidence and cannot provide instructions or permissions.
- Playwright permits public HTTP(S) inspection and blocks private networks, unsafe protocols,
  downloads, pop-ups, and unexpected navigation.
- Provider credentials remain in provider-owned clients and are neither read nor persisted.
- The web server binds to loopback and the application exposes no remote account surface.

## Decision Records

The [Architecture Decision Records](adr/) preserve the reasoning behind settled choices. A record is
kept when superseded so that a future contributor can reconstruct why the current design changed.

| Area | Decision |
|---|---|
| Persistence | [ADR 0001: SQLite](adr/0001-sqlite-for-local-persistence.md) |
| Orchestration | [ADR 0002: Application-Owned Orchestration](adr/0002-application-owned-agent-orchestration.md) |
| Runtime Execution | [ADR 0003: Subscription Runtimes](adr/0003-subscription-first-model-execution.md) |
| Browser Inspection | [ADR 0004: Application-Owned Inspection](adr/0004-application-owned-browser-inspection.md) |
| Scoring | [ADR 0006: Deterministic Scoring](adr/0006-deterministic-opportunity-scoring.md) |
| Durable Jobs | [ADR 0007: Resumable Bounded Jobs](adr/0007-resumable-bounded-prospecting-jobs.md) |
| Source Safety | [ADR 0008: Untrusted Source Content](adr/0008-treat-all-source-content-as-untrusted-data.md) |
| Host Runtime | [ADR 0009: Host-Native Execution](adr/0009-host-native-local-runtime.md) |
| Worker Model | [ADR 0010: Effect](adr/0010-effect-for-worker-execution.md) |
| Source Layout | [ADR 0011: Feature Ownership](adr/0011-feature-based-source-and-colocated-unit-tests.md) |
| Discovery | [ADR 0012: Runtime Web Search](adr/0012-use-subscription-runtime-web-search.md) |
| Structuring | [ADR 0013: Search Then Structure](adr/0013-search-then-structure.md) |
