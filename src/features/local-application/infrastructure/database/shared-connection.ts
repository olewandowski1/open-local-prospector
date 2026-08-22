import Database from "better-sqlite3"

const BUSY_TIMEOUT_MILLISECONDS = 5_000

// One handle per file per process; call `closeSharedDatabases` before renaming or deleting it.
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

export function closeSharedDatabases(): void {
  for (const [key, database] of connections) {
    try {
      if (database.open) database.close()
    } finally {
      connections.delete(key)
    }
  }
}
