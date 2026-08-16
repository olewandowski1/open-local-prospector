import Database from "better-sqlite3"
import { Effect, Layer, Option } from "effect"

import {
  RuntimePreferenceError,
  RuntimePreferenceRepository,
} from "@/features/runtime-settings/application/runtime-preference"
import {
  type RuntimeId,
  runtimeIds,
} from "@/features/runtime-settings/application/runtime-readiness"

const PREFERENCE_KEY = "selected_runtime"

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
      .prepare("select value from local_preferences where key = ?")
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
        `insert into local_preferences (key, value, updated_at)
         values (?, ?, ?)
         on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(PREFERENCE_KEY, runtimeId, Date.now())
  } finally {
    database.close()
  }
}

function isRuntimeId(value: string): value is RuntimeId {
  return runtimeIds.some((runtimeId) => runtimeId === value)
}
