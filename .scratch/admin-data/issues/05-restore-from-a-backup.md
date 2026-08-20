# 05 — Restore From A Backup

**What to build:** Accept a `.sqlite` snapshot and make it the live workspace, so a backup is useful
inside the application and not only outside it.

**Blocked by:** `02`. Highest risk item in this feature — it replaces live data.

**Status:** needs-decision

- [ ] The uploaded file is validated **before** anything is replaced: it opens as SQLite, passes
      `integrity_check`, and its `__drizzle_migrations` state is recognised by this build.
- [ ] A snapshot from a newer schema is refused with a clear reason rather than migrated downward.
- [ ] The displaced database is moved aside, not deleted, and the screen says where it went.
- [ ] Refuses while any run is non-terminal.
- [ ] Artifacts are not in the snapshot, so the screen states plainly that screenshots from the
      restored runs will be missing. A restore is not a time machine.
- [ ] A test restores a snapshot taken from a seeded database and asserts the live database matches it.

## Open question

Whether this belongs in the product at all. Everything else here is reversible or additive; this one
can lose work. The alternative is to keep restore a documented manual step — stop the app, swap the
file — which is honest about how consequential it is. **Oliver's call.**
