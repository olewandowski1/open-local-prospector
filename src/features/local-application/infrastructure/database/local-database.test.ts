import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
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
  const directory = mkdtempSync(join(tmpdir(), "open-prospector-"))
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

  it("commits each migration in a separate short transaction", () => {
    const directory = createTemporaryDirectory()
    const migrationsFolder = join(directory, "migrations")
    const metadataFolder = join(migrationsFolder, "meta")
    const databasePath = join(directory, "prospector.sqlite")
    mkdirSync(metadataFolder, { recursive: true })
    writeFileSync(
      join(metadataFolder, "_journal.json"),
      JSON.stringify({
        version: "7",
        dialect: "sqlite",
        entries: [
          { idx: 0, version: "6", when: 1, tag: "0000_valid", breakpoints: true },
          { idx: 1, version: "6", when: 2, tag: "0001_invalid", breakpoints: true },
        ],
      }),
    )
    writeFileSync(
      join(migrationsFolder, "0000_valid.sql"),
      "create table first_migration (id integer);",
    )
    writeFileSync(join(migrationsFolder, "0001_invalid.sql"), "this is not valid sql;")

    expect(() => migrateLocalDatabase(databasePath, migrationsFolder)).toThrow()

    const verification = new Database(databasePath, { readonly: true })
    expect(
      verification
        .prepare("select name from sqlite_master where type = 'table' and name = 'first_migration'")
        .pluck()
        .get(),
    ).toBe("first_migration")
    expect(verification.prepare("select count(*) from __drizzle_migrations").pluck().get()).toBe(1)
    verification.close()
  })
})
