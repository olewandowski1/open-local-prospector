import Database from "better-sqlite3"
import { Effect, Layer, Option } from "effect"

import {
  RuntimePreferenceError,
  RuntimePreferenceRepository,
} from "@/features/runtime-settings/application/runtime-preference"
import {
  isRuntimeId,
  type RuntimeId,
} from "@/features/runtime-settings/application/runtime-readiness"

const PREFERENCE_KEY = "selected"

export const runtimePreferenceLive = (databasePath: string) =>
  Layer.succeed(RuntimePreferenceRepository, {
    getSelected: Effect.try({
      try: () => readSelectedRuntime(databasePath),
      catch: () => new RuntimePreferenceError({ operation: "read" }),
    }),
    setSelected: (runtimeId) =>
      Effect.try({
        try: () => writeSelectedRuntime(databasePath, runtimeId),
        catch: () => new RuntimePreferenceError({ operation: "write" }),
      }),
  })

function readSelectedRuntime(databasePath: string): Option.Option<RuntimeId> {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true })
  try {
    const value = database
      .prepare("select runtime_id from runtime_preferences where key = ?")
      .pluck()
      .get(PREFERENCE_KEY)
    return typeof value === "string" && isRuntimeId(value) ? Option.some(value) : Option.none()
  } finally {
    database.close()
  }
}

function writeSelectedRuntime(databasePath: string, runtimeId: RuntimeId): void {
  const database = new Database(databasePath, { fileMustExist: true })
  try {
    database.pragma("foreign_keys = ON")
    database.pragma("busy_timeout = 5000")
    database
      .prepare(
        `insert into runtime_preferences (key, runtime_id, updated_at)
         values (?, ?, ?)
         on conflict(key) do update set runtime_id = excluded.runtime_id, updated_at = excluded.updated_at`,
      )
      .run(PREFERENCE_KEY, runtimeId, Date.now())
  } finally {
    database.close()
  }
}
