import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import Database from "better-sqlite3"
import { afterEach, describe, expect, it } from "vitest"

import {
  inspectLocalDatabase,
  migrateLocalDatabase,
} from "@/features/local-application/infrastructure/database/local-database"

const temporaryDirectories: string[] = []

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "open-local-prospector-"))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe("local database", () => {
  it("migrates a fresh database with the required SQLite settings", () => {
    const databasePath = join(createTemporaryDirectory(), "state", "prospector.sqlite")

    migrateLocalDatabase(databasePath)

    expect(inspectLocalDatabase(databasePath)).toEqual({
      journalMode: "wal",
      foreignKeys: true,
      busyTimeoutMilliseconds: 5_000,
    })
  })

  it("preserves existing data when migrations are repeated", () => {
    const databasePath = join(createTemporaryDirectory(), "prospector.sqlite")
    migrateLocalDatabase(databasePath)
    const sqlite = new Database(databasePath)
    sqlite
      .prepare("insert into local_preferences (key, value, updated_at) values (?, ?, ?)")
      .run("marker", "keep-me", Date.now())
    sqlite.close()

    migrateLocalDatabase(databasePath)

    const verification = new Database(databasePath, { readonly: true })
    expect(
      verification
        .prepare("select value from local_preferences where key = ?")
        .pluck()
        .get("marker"),
    ).toBe("keep-me")
    verification.close()
  })

  it("keeps the generated migration under source control", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "drizzle/0000_prepare_local_application.sql"),
      "utf8",
    )
    expect(migration).toContain("CREATE TABLE `local_preferences`")
  })
})
