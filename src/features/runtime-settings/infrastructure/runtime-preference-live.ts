import Database from "better-sqlite3"
import { Effect, Layer, Option } from "effect"
import {
  defaultRuntimeExecutionConfiguration,
  isRuntimeExecutionConfiguration,
} from "@/features/runtime-settings/application/runtime-execution-configuration"
import {
  RuntimePreferenceError,
  RuntimePreferenceRepository,
  type SelectedRuntimePreference,
} from "@/features/runtime-settings/application/runtime-preference"
import { isRuntimeId } from "@/features/runtime-settings/application/runtime-readiness"

const PREFERENCE_KEY = "selected"

export const runtimePreferenceLive = (databasePath: string) =>
  Layer.succeed(RuntimePreferenceRepository, {
    getSelected: Effect.try({
      try: () => readSelectedRuntime(databasePath),
      catch: () => new RuntimePreferenceError({ operation: "read" }),
    }),
    setSelected: (preference) =>
      Effect.try({
        try: () => writeSelectedRuntime(databasePath, preference),
        catch: () => new RuntimePreferenceError({ operation: "write" }),
      }),
  })

function readSelectedRuntime(databasePath: string): Option.Option<SelectedRuntimePreference> {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true })
  try {
    const row = database
      .prepare("select runtime_id, model, reasoning_effort from runtime_preferences where key = ?")
      .get(PREFERENCE_KEY) as
      | { runtime_id: string; model: string | null; reasoning_effort: string | null }
      | undefined
    if (!row || !isRuntimeId(row.runtime_id)) return Option.none()
    const candidate = { model: row.model, reasoningEffort: row.reasoning_effort }
    return Option.some({
      runtimeId: row.runtime_id,
      configuration: isRuntimeExecutionConfiguration(row.runtime_id, candidate)
        ? candidate
        : defaultRuntimeExecutionConfiguration(row.runtime_id),
    })
  } finally {
    database.close()
  }
}

function writeSelectedRuntime(databasePath: string, preference: SelectedRuntimePreference): void {
  const database = new Database(databasePath, { fileMustExist: true })
  try {
    database.pragma("foreign_keys = ON")
    database.pragma("busy_timeout = 5000")
    database
      .prepare(
        `insert into runtime_preferences (key, runtime_id, model, reasoning_effort, updated_at)
         values (?, ?, ?, ?, ?)
         on conflict(key) do update set runtime_id = excluded.runtime_id, model = excluded.model,
           reasoning_effort = excluded.reasoning_effort, updated_at = excluded.updated_at`,
      )
      .run(
        PREFERENCE_KEY,
        preference.runtimeId,
        preference.configuration.model,
        preference.configuration.reasoningEffort,
        Date.now(),
      )
  } finally {
    database.close()
  }
}
