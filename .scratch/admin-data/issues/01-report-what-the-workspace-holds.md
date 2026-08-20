# 01 — Report What The Workspace Holds

**What to build:** A Data section in Settings that states, accurately, what this workspace has
accumulated: the database size, the artifacts count and size, and row counts for the things an
operator recognises — runs, discovered businesses, qualified candidates, decisions recorded,
technical events. It exists in its own right, and it is also what makes the destructive actions in
`02` and `03` legible: you can see what you are about to copy or delete.

**Blocked by:** None.

**Status:** implemented and verified

- [ ] `/settings/data` is a fourth section beside General, Appearance and Subscription, reachable from
      the settings sidebar.
- [ ] Figures come from the live database and the artifacts directory, never from cached or estimated
      values, and no figure is shown that has not been read.
- [ ] Sizes are human readable and rounded; a raw byte count is a bug. Counts are `tabular-nums`.
- [ ] The section reports the database path and the artifacts path, so an operator can find them
      without reading the source.
- [ ] A pure function maps the raw counts to what is displayed, with unit tests, per the
      `*-presentation.ts` rule.
- [ ] The read is bounded: one connection, opened read-only, closed in a `finally`.
- [ ] A test fails if a table is added to the schema and not classified as data, preference or
      bookkeeping. This is the guard that stops `03` silently missing a table later.

## Notes

The table split is in `spec.md` and is the single source of truth for `01`, `02` and `03`. Encode it
once, in the domain, and have all three read it.
