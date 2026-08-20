# 05 — Restore From A Backup

**What to build:** Accept a `.sqlite` snapshot and make it the live workspace, so a backup is useful
inside the application and not only outside it.

**Blocked by:** `02`. Highest risk item in this feature — it replaces live data.

**Status:** implemented and verified — restore is part of the requested application workflow.

- [ ] The uploaded file is validated **before** anything is replaced: it opens as SQLite, passes
      `integrity_check`, and its `__drizzle_migrations` state is recognised by this build.
- [ ] A snapshot from a newer schema is refused with a clear reason rather than migrated downward.
- [ ] A complete recovery backup of the displaced workspace is created first, retained, and its path
      is reported.
- [ ] Refuses while any run is non-terminal.
- [ ] Database and artifacts are restored together from the Application Backup. Archive traversal,
      links, unexpected members and expansion beyond the documented bound are refused.
- [ ] A test restores a snapshot taken from a seeded database and asserts the live database matches it.

## Decision

Restore belongs in the application and is guarded by typed confirmation, compatibility validation,
active-run refusal, a cross-process maintenance lock and an automatic recovery backup.
