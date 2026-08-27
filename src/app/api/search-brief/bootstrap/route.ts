import { Effect, Option } from "effect"
import { NextResponse } from "next/server"

import { loadLocalApplicationConfig } from "@/features/local-application/configuration"
import { getSearchBriefDefaults } from "@/features/prospecting-runs/application/prospecting-run"
import { sqliteProspectingRunRepositoryLive } from "@/features/prospecting-runs/infrastructure/sqlite-prospecting-run-repository"
import { getSelectedRuntime } from "@/features/runtime-settings/application/runtime-preference"
import { runtimePreferenceLive } from "@/features/runtime-settings/infrastructure/runtime-preference-live"

// Load persisted defaults separately so slow CLI probes do not block the editable form.
export async function GET() {
  const config = loadLocalApplicationConfig()
  const [defaults, selectedRuntime] = await Promise.all([
    Effect.runPromise(
      getSearchBriefDefaults.pipe(
        Effect.provide(sqliteProspectingRunRepositoryLive(config.databasePath)),
      ),
    ),
    Effect.runPromise(
      getSelectedRuntime.pipe(Effect.provide(runtimePreferenceLive(config.databasePath))),
    ),
  ])
  return NextResponse.json({
    defaults: Option.getOrUndefined(defaults),
    selectedRuntime: Option.getOrUndefined(selectedRuntime),
  })
}
