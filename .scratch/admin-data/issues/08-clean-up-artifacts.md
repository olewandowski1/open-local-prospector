# Clean Up Artifacts

Status: implemented, ticket written after the fact

Screenshots outlive the decisions they supported. A candidate archived months ago still holds two
PNGs per inspected page, and a run deleted while a write was in flight can leave files behind that no
database row references. Neither is reachable from the interface, so the only way to reclaim the space
is a file manager and knowledge of the artifacts layout.

This was built alongside tickets 01–07 without a ticket of its own. It is recorded here so the
behaviour is specified rather than inferred from the code.

## What it does

Removes two kinds of file from `PROSPECTOR_ARTIFACTS_PATH`:

- Screenshots belonging to candidates whose Review Status is Archived.
- Any file beneath the artifacts path that no `inspection_artifacts` row references.

It never touches the database. Nothing is deleted for a candidate in any other Review Status, and a
file that cannot be removed is counted and reported rather than passed over in silence.

## Acceptance

- [x] Refuses while a run is not in a terminal state, like every other maintenance operation.
- [x] Requires the operator to type CLEANUP, since it is not reversible.
- [x] Reports how many files were removed and how many could not be, in the operator's words.
- [x] Leaves artifacts for Unreviewed, Shortlisted, Rejected and Contacted candidates in place.
- [x] Covered by `workspace-store.test.ts`, which asserts an archived file and an orphan are removed
      while a live artifact survives.

## Comments

Raised by a review of the change against this feature's spec: the behaviour is a deliberate and
useful one, but the spec confined artifact deletion to tickets 03 and 04, so nothing recorded that
this existed or what it was allowed to touch.
