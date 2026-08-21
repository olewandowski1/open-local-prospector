import Database from "better-sqlite3"

const BUSY_TIMEOUT_MILLISECONDS = 5_000

/**
 * One connection per database file per process, reused for every operation against it.
 *
 * `better-sqlite3` is synchronous, so a single connection serialises access without a pool, and the
 * value it offers -- prepared statements it can reuse -- is thrown away by opening a fresh handle for
 * every call. Measured on this workspace: opening, configuring, preparing, querying and closing costs
 * 3.34 ms, against 0.01 ms on a connection and statement already in hand. The worker paid that twice a
 * second while idle, and every polled request paid it again.
 *
 * Handles are held open, which matters because restoring a backup renames the live database file and
 * Windows refuses to rename a file that is open. Anything that moves or deletes the file must call
 * `closeSharedDatabases` first, and the worker releases its handle whenever a maintenance operation
 * holds the workspace lease.
 */
const connections = new Map<string, Database.Database>()

export function sharedDatabase(databasePath: string, readonly = false): Database.Database {
  const key = `${readonly ? "r" : "w"}:${databasePath}`
  const open = connections.get(key)
  if (open?.open) return open
  const database = new Database(databasePath, { readonly, fileMustExist: true })
  database.pragma("foreign_keys = ON")
  database.pragma(`busy_timeout = ${BUSY_TIMEOUT_MILLISECONDS}`)
  connections.set(key, database)
  return database
}

/**
 * Releases every handle this process holds. Safe to call when none are open, and the next call to
 * `sharedDatabase` simply opens a new one, so this is a release rather than a shutdown.
 */
export function closeSharedDatabases(): void {
  for (const [key, database] of connections) {
    try {
      if (database.open) database.close()
    } finally {
      connections.delete(key)
    }
  }
}
