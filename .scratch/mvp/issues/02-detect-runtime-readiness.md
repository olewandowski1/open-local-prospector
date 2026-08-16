# 02 — Detect subscription runtime readiness

**What to build:** Let Oliver verify and select locally installed Codex, Claude Code, or OpenCode subscriptions without giving the Local Application access to provider credentials.

**Blocked by:** 01 — Prepare the Local Application.

**Status:** resolved

- [x] Codex, Claude Code, and OpenCode implement one application-owned readiness contract.
- [x] Probes launch known executables directly with fixed arguments and no shell.
- [x] Readiness is classified as Ready, Missing, Logged Out, Unreachable, or Unsupported Version using only supported executable/status behavior.
- [x] The application never reads, copies, parses, persists, or displays provider tokens or authentication caches.
- [x] Settings shows actionable terminal instructions for missing, logged-out, and unsupported runtimes but never initiates login.
- [x] Oliver's selected runtime preference is stored locally and restored on the next visit.
- [x] Deterministic adapter fixtures cover every readiness state without requiring real provider accounts in automated tests.

## Answer

Implemented one Effect-backed runtime readiness contract for Codex CLI, Claude Code, and OpenCode. Production probes resolve only application-owned executable candidates, launch them directly with fixed version/status arguments and no shell, bound time/output, sanitize the inherited environment, and reduce supported CLI output to status and version metadata. Settings provides terminal-only remediation and persists only the selected ready runtime in SQLite.

Verified with fixtures for all five readiness states across all three adapters, strict subscription-status parsing, Effect-native subprocess timeout/output bounds, SQLite preference migration and restoration, live local provider checks, `pnpm check` (71 tests and production build), and `pnpm test:e2e` (10 passed, 2 expected platform skips).
