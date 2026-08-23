import { Effect, Option } from "effect"
import { NextResponse } from "next/server"

import { loadLocalApplicationConfig } from "@/features/local-application/configuration"
import { getSearchBriefDefaults } from "@/features/prospecting-runs/application/prospecting-run"
import { sqliteProspectingRunRepositoryLive } from "@/features/prospecting-runs/infrastructure/sqlite-prospecting-run-repository"
import { getSelectedRuntime } from "@/features/runtime-settings/application/runtime-preference"
import type { RuntimeId } from "@/features/runtime-settings/application/runtime-readiness"
import { runtimePreferenceLive } from "@/features/runtime-settings/infrastructure/runtime-preference-live"

// Fast persisted defaults for the New Run sheet. Runtime probing is deliberately separate so slow
// CLI status commands never hold back the editable Search Brief.
export async function GET() {
  const config = loadLocalApplicationConfig()
  const [defaults, selectedRuntime] = await Promise.all([
    Effect.runPromise(
      getSearchBriefDefaults.pipe(
        Effect.catchAll(() => Effect.succeed(Option.none())),
        Effect.provide(sqliteProspectingRunRepositoryLive(config.databasePath)),
      ),
    ),
    Effect.runPromise(
      getSelectedRuntime.pipe(
        Effect.catchAll(() => Effect.succeed(Option.none<RuntimeId>())),
        Effect.provide(runtimePreferenceLive(config.databasePath)),
      ),
    ),
  ])
  return NextResponse.json({
    defaults: Option.getOrUndefined(defaults),
    selectedRuntime: Option.getOrUndefined(selectedRuntime),
  })
}
