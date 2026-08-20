# Data And Storage administration

A place to look after the workspace itself: see what it holds, take a copy of it, and empty it.

## Why

Everything this application produces lives in one SQLite file and one artifacts directory. Today
nothing in the interface acknowledges that. There is no way to take a backup before an experiment, no
way to start again after one, and no way to see how much a run has accumulated. The only route is a
terminal and knowledge of where the files sit.

"Admin" here means blast radius, not permissions. The application binds to `127.0.0.1` and has one
operator, so **no authentication is to be added** — a login would imply a threat model this
application does not have. What these actions need is confirmation, accuracy about what they touch,
and refusal when the workspace is busy.

## What exists to build on

| Fact | Consequence for this work |
| --- | --- |
| `journal_mode = WAL` (verified) | A backup must never be a file copy. `-wal` and `-shm` hold committed data the main file does not. `vacuum into` produced a byte-complete, `integrity_check = ok` snapshot of the 1.1 MB database in **40 ms**. |
| Artifacts are files under `.local/artifacts` (`PROSPECTOR_ARTIFACTS_PATH`) | Clearing rows without deleting these leaves orphans on disk that nothing references and nothing will ever remove. |
| Schema is 29 tables, migrated by Drizzle | A reset must leave a **migrated, empty** database, not a missing file. Deleting the file and re-migrating is one way; `delete from` per table inside a transaction is the other. |
| Settings already has an internal sidebar (General, Appearance, Subscription) | This becomes a fourth section rather than a new top-level page. |
| Runs can be non-terminal, and the worker holds leases | A reset while a run is in flight would delete rows the worker is about to write to. It must refuse. |

## Table inventory

Counts are from the working database at the time of writing, as a sanity check that the split below
is complete — 29 tables, all accounted for.

**Prospecting data — what a reset clears (24 tables)**

`prospecting_runs` · `run_tasks` · `run_transitions` · `run_metrics` · `run_businesses` ·
`discovered_businesses` · `discovery_occurrences` · `discovery_queries` · `canonical_businesses` ·
`identity_evidence_queries` · `identity_evidence_results` · `online_presences` · `contact_routes` ·
`website_inspections` · `inspection_pages` · `inspection_blocks` · `inspection_artifacts` ·
`website_assessments` · `website_opportunities` · `supporting_observations` · `candidate_scores` ·
`candidate_reviews` · `candidate_corrections` · `technical_run_events`

**Kept, because losing them helps nobody**

- `runtime_preferences`, `prospecting_defaults`, `local_preferences` — the operator's own choices.
  Re-picking a runtime after a reset is friction with no upside.
- `geocoding_cache` — a cache of public Nominatim answers. Nominatim is rate limited to one request
  per second and its usage policy asks callers to cache; throwing it away is antisocial as well as
  slow.

**Needs your decision**

- `suppression_entries` — "never show me this business again" is a deliberate, durable instruction,
  not run output. My recommendation is that it **survives** a reset, with a separate, explicit way to
  clear it, because a reset is about discarding results and a suppression is a standing preference.

**Not data**

- `__drizzle_migrations` — schema bookkeeping. A reset must leave it intact, or the next start
  re-applies every migration.

## Scope

### First slice

1. **A Data section in Settings** that states what the workspace holds: database size, artifact count
   and size, and row counts for the things an operator recognises — runs, candidates, decisions
   recorded. This is also what makes the two destructive actions legible: you see what you are about
   to copy or delete.
2. **Download a backup.** One click produces a `vacuum into` snapshot and streams it as
   `open-local-prospector-YYYY-MM-DD.sqlite`. Read-only, safe while the worker runs.
3. **Reset the workspace.** Clears the 24 data tables and the artifacts directory, keeps preferences,
   leaves a migrated empty schema. Refuses while any run is non-terminal. Offers the backup inline in
   the confirmation, because the moment someone wants a reset is exactly the moment they should be
   asked whether they have a copy.

### Follow-ups, in the order I would take them

4. **Delete one run**, with its businesses, evidence and artifacts. In practice this is the action
   wanted most often — one bad run spoils a queue, and nuking everything to remove it is a poor
   trade.
5. **Restore from a backup.** Completes the pair; without it a backup is only useful outside the
   application. Higher risk than everything above: it replaces the live database, so it must verify
   `integrity_check` and the migration state of the uploaded file *before* swapping, and keep the
   displaced database aside rather than deleting it.
6. **Suppression list.** Suppressing is currently a one-way door with no interface to see or undo it.
   Small, and it closes a gap the review flow opened.
7. **Compact.** SQLite does not return freed pages after a large delete. One button running `vacuum`,
   showing the size before and after.

## Out of scope

- Authentication, roles, audit logs. One local operator; see above.
- Scheduled or automatic backups. This is a desktop-shaped tool; a button the operator presses is
  honest about when a copy was taken. Revisit if runs ever become unattended.
- Editing data by hand. Corrections already have a first-class, recorded path through the review
  panel; a raw table editor would bypass it.

## Risks

- **A reset that half-succeeds** is worse than one that fails. Row deletion runs in a single
  transaction. Artifacts are deleted after the transaction commits, and a failure there is reported
  as leftover files rather than silently swallowed — the database is the source of truth for what
  exists.
- **Deleting artifacts is not transactional with SQLite.** Order matters: commit the row deletion
  first, then remove files. The reverse loses evidence that rows still point at.
- **A backup taken mid-run** is internally consistent but describes a run that has since moved on.
  Worth saying so on the screen rather than pretending a snapshot is a pause.
- **`vacuum into` needs free disk** roughly equal to the database size. Cheap now at 1.1 MB; worth a
  clear error rather than a stack trace when it is not.

## Acceptance

- The Data section reports figures that match the database, and says so in units a reader recognises.
- A downloaded snapshot opens as a valid SQLite database, passes `integrity_check`, and contains the
  same row counts as the source at the moment it was taken.
- A reset with an active run is refused, and says which run is active.
- After a reset: the 24 data tables are empty, the artifacts directory is empty, the runtime and brief
  preferences are unchanged, `__drizzle_migrations` is untouched, and Overview, Runs and Review Queue
  each show their empty state rather than an error.
- Every figure shown and every count deleted is covered by a test that would fail if a new table were
  added to the schema and forgotten here.
