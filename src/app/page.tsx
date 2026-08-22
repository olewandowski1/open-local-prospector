import { Effect, Option } from "effect"
import { connection } from "next/server"
import { Suspense } from "react"

import { AppShell } from "@/components/app-shell/app-shell"
import { loadLocalApplicationConfig } from "@/features/local-application/configuration"
import {
  OverviewPage,
  type RuntimeSteering,
  RuntimeSteeringPanel,
  RuntimeSteeringSkeleton,
} from "@/features/overview"
import { getCandidateSummary, getRecentCandidates } from "@/features/review-queue"
import { listPersistedRuns } from "@/features/run-monitoring/server/run-services"
import { isRuntimeExecutionConfiguration } from "@/features/runtime-settings/application/runtime-execution-configuration"
import {
  getSelectedRuntimePreference,
  type SelectedRuntimePreference,
  setSelectedRuntimePreference,
} from "@/features/runtime-settings/application/runtime-preference"
import {
  getAllRuntimeReadiness,
  isRuntimeId,
} from "@/features/runtime-settings/application/runtime-readiness"
import { runtimePreferenceLive } from "@/features/runtime-settings/infrastructure/runtime-preference-live"
import { RuntimeProbeLive } from "@/features/runtime-settings/infrastructure/runtime-probe-live"

// Readiness is not re-probed here: preflight already refuses a run whose runtime is not Ready.
async function saveSteering(steering: RuntimeSteering): Promise<void> {
  "use server"

  const { runtimeId, model, reasoningEffort } = steering
  if (!isRuntimeId(runtimeId)) return
  const configuration = { model, reasoningEffort }
  if (!isRuntimeExecutionConfiguration(runtimeId, configuration)) return

  const config = loadLocalApplicationConfig()
  await Effect.runPromise(
    setSelectedRuntimePreference({ runtimeId, configuration }).pipe(
      Effect.provide(runtimePreferenceLive(config.databasePath)),
    ),
  )
}

async function SteeringPanel() {
  const config = loadLocalApplicationConfig()
  const [runtimes, preference] = await Promise.all([
    Effect.runPromise(getAllRuntimeReadiness.pipe(Effect.provide(RuntimeProbeLive))),
    Effect.runPromise(
      getSelectedRuntimePreference.pipe(
        Effect.catchAll(() => Effect.succeed(Option.none<SelectedRuntimePreference>())),
        Effect.provide(runtimePreferenceLive(config.databasePath)),
      ),
    ),
  ])
  const selected = Option.getOrUndefined(preference)

  return (
    <RuntimeSteeringPanel
      runtimes={runtimes}
      steering={selected ? { runtimeId: selected.runtimeId, ...selected.configuration } : undefined}
      saveSteering={saveSteering}
    />
  )
}

export default async function OverviewRoute() {
  await connection()
  const runs = await listPersistedRuns()
  const now = new Date()

  return (
    <AppShell>
      <OverviewPage
        now={now}
        runs={runs}
        candidateSummary={getCandidateSummary(now)}
        recentCandidates={getRecentCandidates()}
        steeringPanel={
          <Suspense fallback={<RuntimeSteeringSkeleton />}>
            <SteeringPanel />
          </Suspense>
        }
      />
    </AppShell>
  )
}
