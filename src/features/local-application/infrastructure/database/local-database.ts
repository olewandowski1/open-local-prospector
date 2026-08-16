import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"

import Database from "better-sqlite3"
import { readMigrationFiles } from "drizzle-orm/migrator"

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
    applyPendingMigrations(sqlite, migrationsFolder)
  } finally {
    sqlite.close()
  }
}

function applyPendingMigrations(sqlite: Database.Database, migrationsFolder: string): void {
  sqlite.exec(`
    create table if not exists __drizzle_migrations (
      id integer primary key autoincrement,
      hash text not null,
      created_at numeric not null
    )
  `)
  const latest = sqlite
    .prepare("select created_at from __drizzle_migrations order by created_at desc limit 1")
    .get() as { created_at: number } | undefined
  const recordMigration = sqlite.prepare(
    "insert into __drizzle_migrations (hash, created_at) values (?, ?)",
  )

  for (const migration of readMigrationFiles({ migrationsFolder })) {
    if (latest && latest.created_at >= migration.folderMillis) continue

    sqlite.transaction(() => {
      for (const statement of migration.sql) sqlite.exec(statement)
      recordMigration.run(migration.hash, migration.folderMillis)
    })()
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
