# 01 — Prepare the Local Application

**What to build:** Make a fresh local installation self-preparing and diagnosable. Oliver can run the documented setup command, obtain a correctly configured SQLite database and artifact directories, and see whether the non-runtime dependencies required for prospecting are ready.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] `pnpm run setup` is idempotent and creates or migrates the configurable local SQLite database without Docker. (`pnpm setup` is a reserved pnpm command.)
- [x] SQLite enables WAL mode, foreign keys, a busy timeout, and short migration transactions.
- [x] Setup creates ignored artifact/configuration directories and a non-secret configuration template without creating or reading provider credentials.
- [x] Setup installs or verifies Playwright Chromium and reports actionable failures.
- [x] Settings reports SQLite, Brave Search configuration, Playwright, and disk readiness as Ready, Missing, Unreachable, or Unsupported Version where applicable.
- [x] Brave Search secrets remain server-side in ignored configuration and are never rendered or logged.
- [x] Re-running setup preserves existing local data and exits successfully when no migration is required.
- [x] Automated tests cover a fresh setup, repeated setup, and a failed dependency check.
