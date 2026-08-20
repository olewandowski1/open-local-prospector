# 03 — Reset The Workspace

**What to build:** Empty the workspace back to a freshly installed state — every prospecting result
gone, the operator's own choices kept, the schema still migrated.

**Blocked by:** `02`, so the confirmation can offer a backup at the moment it is most wanted.

**Status:** ready-for-agent

- [ ] Clears the 24 data tables listed in `spec.md`, in one transaction. A partial reset is worse than
      a refused one.
- [ ] Deletes the contents of the artifacts directory **after** the transaction commits. The database
      is the source of truth for what exists, so rows go first; the reverse orphans evidence that rows
      still point at.
- [ ] Leftover files that could not be removed are reported as such, not swallowed.
- [ ] Keeps `runtime_preferences`, `prospecting_defaults`, `local_preferences` and `geocoding_cache`.
      Nominatim asks callers to cache and rate limits to one request per second; discarding that cache
      is antisocial as well as slow.
- [ ] Leaves `__drizzle_migrations` untouched, so the next start does not re-apply every migration.
- [ ] **Refuses while any run is non-terminal**, and names the run. The worker holds leases and would
      write to rows this deletes.
- [ ] Confirmation is explicit: the operator types the word, sees the counts from `01` that are about
      to go, and is offered the `02` download in the same dialog.
- [ ] Afterwards Overview, Runs and Review Queue each render their empty state rather than an error,
      and starting a new run works without a restart.
- [ ] Whether `suppression_entries` survives follows the decision recorded in `spec.md`. **Open
      question for Oliver** — recommendation there is that it survives, with its own way to clear it.
- [ ] A test resets a seeded database and asserts every data table is empty, every kept table is
      unchanged, and the artifacts directory is empty.
