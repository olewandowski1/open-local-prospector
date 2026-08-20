# 02 — Download A Backup

**What to build:** One click that produces a restorable Application Backup of the database, artifacts
and allowlisted non-secret configuration and streams it to the operator as a file they can keep.

**Blocked by:** None. Independent of `01`, though it belongs on the same screen.

**Status:** implemented and verified

- [ ] The snapshot is produced with `vacuum into` against a temporary path, then streamed and the
      temporary file removed. Verified: 40 ms and `integrity_check = ok` for the 1.1 MB working
      database.
- [ ] **A file copy is never used.** The database runs in WAL mode, so `-wal` holds committed data the
      main file does not; copying the main file alone can yield a stale or invalid database.
- [ ] The database member is produced with `vacuum into`; artifacts, a versioned manifest and an
      allowlisted configuration record are packaged with it.
- [ ] The download is named `open-local-prospector-YYYY-MM-DD-HH-MM-SS.olp-backup.tgz` and served with
      `content-disposition: attachment`.
- [ ] Taking a backup is read-only and safe while the worker is running. A run in flight does not
      block it.
- [ ] The screen says plainly that a snapshot describes the workspace at the moment it was taken, so
      a backup taken mid-run is not mistaken for a pause.
- [ ] Insufficient free disk is reported in the operator's words, not as a stack trace. `vacuum into`
      needs roughly the database size again.
- [ ] A test restores the produced archive and asserts SQLite integrity, source row counts and
      artifact contents.
