import { Effect, Option } from "effect"
import { NextResponse } from "next/server"

import { loadLocalApplicationConfig } from "@/features/local-application/configuration"
import { getSearchBriefDefaults } from "@/features/prospecting-runs/application/prospecting-run"
import { sqliteProspectingRunRepositoryLive } from "@/features/prospecting-runs/infrastructure/sqlite-prospecting-run-repository"
import { getSelectedRuntime } from "@/features/runtime-settings/application/runtime-preference"
import {
  getAllRuntimeReadiness,
  type RuntimeId,
} from "@/features/runtime-settings/application/runtime-readiness"
import { runtimePreferenceLive } from "@/features/runtime-settings/infrastructure/runtime-preference-live"
import { RuntimeProbeLive } from "@/features/runtime-settings/infrastructure/runtime-probe-live"

// One bootstrap payload for the New Run sheet: last brief defaults, which subscription runtimes
// can actually execute, and the runtime the user preferred last time. Read-only; no credential.
export async function GET() {
  const config = loadLocalApplicationConfig()
  const [defaults, runtimes, selectedRuntime] = await Promise.all([
    Effect.runPromise(
      getSearchBriefDefaults.pipe(
        Effect.catchAll(() => Effect.succeed(Option.none())),
        Effect.provide(sqliteProspectingRunRepositoryLive(config.databasePath)),
      ),
    ),
    Effect.runPromise(getAllRuntimeReadiness.pipe(Effect.provide(RuntimeProbeLive))),
    Effect.runPromise(
      getSelectedRuntime.pipe(
        Effect.catchAll(() => Effect.succeed(Option.none<RuntimeId>())),
        Effect.provide(runtimePreferenceLive(config.databasePath)),
      ),
    ),
  ])
  return NextResponse.json({
    defaults: Option.getOrUndefined(defaults),
    runtimes,
    selectedRuntime: Option.getOrUndefined(selectedRuntime),
  })
}
