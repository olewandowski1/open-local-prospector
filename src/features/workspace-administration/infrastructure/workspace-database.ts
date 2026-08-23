import Database from "better-sqlite3"

import {
  BOOKKEEPING_TABLES,
  CLASSIFIED_WORKSPACE_TABLES,
  unclassifiedWorkspaceTables,
} from "@/features/workspace-administration/domain/workspace-schema"

export function openWorkspaceDatabase(path: string, readonly = false): Database.Database {
  const database = new Database(path, { readonly, fileMustExist: true })
  database.pragma("foreign_keys = ON")
  database.pragma("busy_timeout = 5000")
  return database
}

export function assertCompleteTableClassification(database: Database.Database): void {
  const actual = database
    .prepare(
      "select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name",
    )
    .all()
    .map((row) => (row as { name: string }).name)
  const unknown = unclassifiedWorkspaceTables(actual)
  const missing = [...CLASSIFIED_WORKSPACE_TABLES, ...BOOKKEEPING_TABLES].filter(
    (table) => !actual.includes(table),
  )
  if (unknown.length || missing.length) {
    throw new Error(
      `Workspace table classification is out of date. Unknown: ${unknown.join(", ") || "none"}. Missing: ${missing.join(", ") || "none"}.`,
    )
  }
}
