import { Effect } from "effect"

import {
  getLocalReadiness,
  loadLocalApplicationConfig,
  ReadinessProbeLive,
} from "@/features/local-application"
import { confirmSearchBrief } from "@/features/prospecting-runs/application/confirm-search-brief"
import { prepareSearchBrief } from "@/features/prospecting-runs/application/search-brief-preflight"
import { nominatimGeocoderLive } from "@/features/prospecting-runs/infrastructure/nominatim-geocoder-live"
import { sqliteProspectingRunRepositoryLive } from "@/features/prospecting-runs/infrastructure/sqlite-prospecting-run-repository"
import { getRuntimeReadiness, isRuntimeId, RuntimeProbeLive } from "@/features/runtime-settings"

export async function runSearchBriefPreflight(input: unknown) {
  const runtimeId = runtimeIdFromInput(input)
  if (!runtimeId) throw new InvalidSearchBriefRequest()
  const config = loadLocalApplicationConfig()
  const [dependencies, runtime] = await Promise.all([
    Effect.runPromise(getLocalReadiness(config).pipe(Effect.provide(ReadinessProbeLive))),
    Effect.runPromise(getRuntimeReadiness(runtimeId).pipe(Effect.provide(RuntimeProbeLive))),
  ])
  return Effect.runPromise(
    prepareSearchBrief(input, dependencies, runtime).pipe(
      Effect.provide(nominatimGeocoderLive(config.databasePath)),
    ),
  )
}

export async function createConfirmedProspectingRun(
  input: unknown,
  searchAreaId: string,
  requestId: string,
) {
  const runtimeId = runtimeIdFromInput(input)
  if (!runtimeId || !searchAreaId.trim() || !requestId.trim()) throw new InvalidSearchBriefRequest()
  const config = loadLocalApplicationConfig()
  const [dependencies, runtime] = await Promise.all([
    Effect.runPromise(getLocalReadiness(config).pipe(Effect.provide(ReadinessProbeLive))),
    Effect.runPromise(getRuntimeReadiness(runtimeId).pipe(Effect.provide(RuntimeProbeLive))),
  ])
  return Effect.runPromise(
    confirmSearchBrief(input, searchAreaId, requestId, dependencies, runtime).pipe(
      Effect.provide(nominatimGeocoderLive(config.databasePath)),
      Effect.provide(sqliteProspectingRunRepositoryLive(config.databasePath)),
    ),
  )
}

export class InvalidSearchBriefRequest extends Error {}

function runtimeIdFromInput(input: unknown) {
  if (typeof input !== "object" || input === null || !("runtime" in input)) return undefined
  const runtime = input.runtime
  return typeof runtime === "string" && isRuntimeId(runtime) ? runtime : undefined
}
