import { Effect, Option } from "effect"
import { connection } from "next/server"

import { AppShell } from "@/components/app-shell/app-shell"
import { loadLocalApplicationConfig } from "@/features/local-application/configuration"
import { getSearchBriefDefaults } from "@/features/prospecting-runs/application/prospecting-run"
import { sqliteProspectingRunRepositoryLive } from "@/features/prospecting-runs/infrastructure/sqlite-prospecting-run-repository"
import { SearchBriefPage } from "@/features/prospecting-runs/presentation/search-brief-page"
import { getSelectedRuntime } from "@/features/runtime-settings/application/runtime-preference"
import {
  getAllRuntimeReadiness,
  type RuntimeId,
} from "@/features/runtime-settings/application/runtime-readiness"
import { runtimePreferenceLive } from "@/features/runtime-settings/infrastructure/runtime-preference-live"
import { RuntimeProbeLive } from "@/features/runtime-settings/infrastructure/runtime-probe-live"

export default async function NewProspectingRunRoute() {
  await connection()
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
  const readyRuntimes = runtimes.filter((runtime) => runtime.status === "Ready")

  return (
    <AppShell>
      <SearchBriefPage
        defaults={Option.getOrUndefined(defaults)}
        readyRuntimes={readyRuntimes}
        selectedRuntime={Option.getOrUndefined(selectedRuntime)}
      />
    </AppShell>
  )
}
