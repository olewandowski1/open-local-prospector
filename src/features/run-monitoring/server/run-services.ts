import { Effect } from "effect"

import { loadLocalApplicationConfig } from "@/features/local-application"
import type { RuntimeId } from "@/features/prospecting-runs"
import {
  controlRun,
  getRun,
  listRuns,
  type RunControl,
} from "@/features/run-monitoring/application/run-repositories"
import { sqliteRunMonitoringLive } from "@/features/run-monitoring/infrastructure/sqlite-run-monitoring"

const layer = () => sqliteRunMonitoringLive(loadLocalApplicationConfig().databasePath)

export const listPersistedRuns = () => Effect.runPromise(listRuns.pipe(Effect.provide(layer())))
export const getPersistedRun = (runId: string) =>
  Effect.runPromise(getRun(runId).pipe(Effect.provide(layer())))
export const requestRunControl = (runId: string, control: RunControl, runtime?: RuntimeId) =>
  Effect.runPromise(controlRun(runId, control, runtime).pipe(Effect.provide(layer())))
