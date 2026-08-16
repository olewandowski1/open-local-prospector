# 13 — Execute assessments with Claude Code and OpenCode

**What to build:** Add Claude Code and OpenCode as interchangeable subscription-backed assessment runtimes behind the proven application-owned contract, without changing prospecting behavior or safety policy.

**Blocked by:** 02 — Detect subscription runtime readiness; 09 — Assess evidence with the Codex runtime.

**Status:** ready-for-agent

- [ ] Claude Code and OpenCode use the same versioned assessment input/output contract and stage policy as Codex.
- [ ] Each adapter launches its executable directly with fixed supported arguments, no shell, bounded streams, timeouts, and cancellation.
- [ ] Adapter-specific authentication and version failures map to the shared visible readiness/runtime states.
- [ ] No adapter reads or persists provider credentials, exposes broad tools, owns navigation, or changes deterministic scoring.
- [ ] A Prospecting Run keeps one selected runtime unless Oliver explicitly resumes with another; the change and exposed version are recorded.
- [ ] Runtime failure never silently switches provider or invokes a usage-based API.
- [ ] Contract fixtures prove equivalent valid output and safe failure behavior across all three adapters without requiring live subscriptions in CI.
