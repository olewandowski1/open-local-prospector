# 07 — Compact The Database

**What to build:** A button that runs `vacuum`, reporting the size before and after.

**Blocked by:** `01` for the figures, `03` and `04` for the deletions that make it worth having.

**Status:** implemented and verified

- [ ] Runs `vacuum` against the live database and reports both sizes, so the operator sees what it
      achieved rather than trusting it.
- [ ] Refuses while any run is non-terminal; `vacuum` takes a write lock on the whole database.
- [ ] Says what it does in one sentence: SQLite does not hand back pages freed by a delete, and this
      returns them to the filesystem.

## Notes

Low value on a 1.1 MB database, real value after a few hundred runs of screenshots and evidence. Last
in the order for that reason.
