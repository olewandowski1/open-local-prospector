# 02 — Detect subscription runtime readiness

**What to build:** Let Oliver verify and select locally installed Codex, Claude Code, or OpenCode subscriptions without giving the Local Application access to provider credentials.

**Blocked by:** 01 — Prepare the Local Application.

**Status:** ready-for-agent

- [ ] Codex, Claude Code, and OpenCode implement one application-owned readiness contract.
- [ ] Probes launch known executables directly with fixed arguments and no shell.
- [ ] Readiness is classified as Ready, Missing, Logged Out, Unreachable, or Unsupported Version using only supported executable/status behavior.
- [ ] The application never reads, copies, parses, persists, or displays provider tokens or authentication caches.
- [ ] Settings shows actionable terminal instructions for missing, logged-out, and unsupported runtimes but never initiates login.
- [ ] Oliver's selected runtime preference is stored locally and restored on the next visit.
- [ ] Deterministic adapter fixtures cover every readiness state without requiring real provider accounts in automated tests.
