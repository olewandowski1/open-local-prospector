import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"

import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"

const BUSY_TIMEOUT_MILLISECONDS = 5_000

function configureConnection(database: Database.Database): void {
  database.pragma("foreign_keys = ON")
  database.pragma(`busy_timeout = ${BUSY_TIMEOUT_MILLISECONDS}`)
}

export function migrateLocalDatabase(
  databasePath: string,
  migrationsFolder = resolve(process.cwd(), "drizzle"),
): void {
  mkdirSync(dirname(databasePath), { recursive: true })
  const sqlite = new Database(databasePath)

  try {
    configureConnection(sqlite)
    sqlite.pragma("journal_mode = WAL")
    migrate(drizzle({ client: sqlite }), { migrationsFolder })
  } finally {
    sqlite.close()
  }
}

export type DatabaseHealth = Readonly<{
  journalMode: string
  foreignKeys: boolean
  busyTimeoutMilliseconds: number
}>

export function inspectLocalDatabase(databasePath: string): DatabaseHealth {
  const sqlite = new Database(databasePath, { readonly: true, fileMustExist: true })

  try {
    configureConnection(sqlite)
    sqlite.prepare("select 1").get()

    return {
      journalMode: String(sqlite.pragma("journal_mode", { simple: true })),
      foreignKeys: sqlite.pragma("foreign_keys", { simple: true }) === 1,
      busyTimeoutMilliseconds: Number(sqlite.pragma("busy_timeout", { simple: true })),
    }
  } finally {
    sqlite.close()
  }
}
