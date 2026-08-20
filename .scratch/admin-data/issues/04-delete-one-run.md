# 04 — Delete One Run

**What to build:** Remove a single run and everything derived from it, as a surgical alternative to
resetting the whole workspace.

**Blocked by:** `03`, which establishes the deletion order and the artifact handling this reuses.

**Status:** implemented and verified

- [ ] Reachable from the run's own detail page and from the runs list action column.
- [ ] Removes the run, its tasks, transitions, metrics, businesses, discoveries, identity evidence,
      inspections, assessments, scores, reviews, corrections, technical events, and its artifacts.
- [ ] A canonical business reached by more than one run is **not** removed while another run still
      references it. Identity is shared across runs by design, and dedup work depends on it.
- [ ] Refuses while that run is non-terminal.
- [ ] Confirmation states what will go, in counts, for that run specifically.
- [ ] A test seeds two runs that share a canonical business, deletes one, and asserts the other keeps
      its candidate intact.

## Notes

In practice this is the action wanted most often: one poor run spoils a queue, and clearing everything
to remove it is a bad trade. Worth doing even though `03` technically covers the same ground.
