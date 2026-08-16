import Database from "better-sqlite3"
import { Effect, Layer, Option } from "effect"

import {
  type PendingProspectingRun,
  ProspectingRunRepositoryTag,
  type SearchBriefDefaults,
} from "@/features/prospecting-runs/application/prospecting-run"
import type { SearchBrief } from "@/features/prospecting-runs/domain/search-brief"

const DEFAULTS_KEY = "last-confirmed"

export const sqliteProspectingRunRepositoryLive = (databasePath: string) =>
  Layer.succeed(ProspectingRunRepositoryTag, {
    createPending: (searchBrief, requestId) =>
      Effect.sync(() => createPending(databasePath, searchBrief, requestId)),
    getDefaults: Effect.sync(() => readDefaults(databasePath)),
  })

function createPending(
  databasePath: string,
  searchBrief: SearchBrief,
  requestId: string,
): PendingProspectingRun {
  const database = new Database(databasePath, { fileMustExist: true })
  database.pragma("foreign_keys = ON")
  database.pragma("busy_timeout = 5000")
  try {
    return database.transaction(() => {
      const existing = readRunByRequest(database, requestId)
      if (existing) return existing

      const run: PendingProspectingRun = {
        id: crypto.randomUUID(),
        requestId,
        state: "Pending",
        searchBrief,
        createdAt: new Date(),
      }
      database
        .prepare(
          "insert into prospecting_runs (id, request_id, state, search_brief, created_at) values (?, ?, ?, ?, ?)",
        )
        .run(run.id, requestId, run.state, JSON.stringify(searchBrief), run.createdAt.getTime())
      database
        .prepare(
          `insert into prospecting_defaults (key, radius_km, category, target_count, mode, updated_at)
           values (?, ?, ?, ?, ?, ?)
           on conflict(key) do update set radius_km = excluded.radius_km, category = excluded.category,
             target_count = excluded.target_count, mode = excluded.mode, updated_at = excluded.updated_at`,
        )
        .run(
          DEFAULTS_KEY,
          searchBrief.radiusKm ?? null,
          searchBrief.category,
          searchBrief.targetCount,
          searchBrief.mode,
          Date.now(),
        )
      return run
    })()
  } finally {
    database.close()
  }
}

function readRunByRequest(
  database: Database.Database,
  requestId: string,
): PendingProspectingRun | undefined {
  const row = database
    .prepare(
      "select id, request_id, state, search_brief, created_at from prospecting_runs where request_id = ?",
    )
    .get(requestId) as
    | { id: string; request_id: string; state: "Pending"; search_brief: string; created_at: number }
    | undefined
  return row
    ? {
        id: row.id,
        requestId: row.request_id,
        state: row.state,
        searchBrief: JSON.parse(row.search_brief) as SearchBrief,
        createdAt: new Date(row.created_at),
      }
    : undefined
}

function readDefaults(databasePath: string): Option.Option<SearchBriefDefaults> {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true })
  try {
    const row = database
      .prepare(
        "select radius_km, category, target_count, mode from prospecting_defaults where key = ?",
      )
      .get(DEFAULTS_KEY) as
      | { radius_km: number | null; category: string; target_count: number; mode: string }
      | undefined
    if (!row || (row.mode !== "Quick" && row.mode !== "Thorough")) return Option.none()
    return Option.some({
      ...(row.radius_km === null ? {} : { radiusKm: row.radius_km }),
      category: row.category,
      targetCount: row.target_count,
      mode: row.mode,
    })
  } finally {
    database.close()
  }
}
