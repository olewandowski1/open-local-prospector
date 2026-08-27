import Database from "better-sqlite3"
import { Effect } from "effect"

import { loadLocalApplicationConfig } from "@/features/local-application"
import { startProspectingRun } from "@/features/prospecting-runs/application/prospecting-run"
import { sqliteProspectingRunRepositoryLive } from "@/features/prospecting-runs/infrastructure/sqlite-prospecting-run-repository"
import { getRuntimeReadiness, isRuntimeId, RuntimeProbeLive } from "@/features/runtime-settings"

export class InvalidReassessmentRequest extends Error {}
export class ReassessmentAlreadyRunning extends Error {}
export class RuntimeNotReadyForReassessment extends Error {}

export async function createReassessmentRun(
  input: Readonly<{
    discoveredBusinessId: string
    sourceSearchBrief: unknown
  }>,
) {
  const source = reassessableBrief(input.sourceSearchBrief)
  if (!source || !input.discoveredBusinessId.trim()) throw new InvalidReassessmentRequest()
  // Repeat reassessment is allowed, but not two runs at once for the same business.
  if (hasActiveReassessment(input.discoveredBusinessId)) throw new ReassessmentAlreadyRunning()
  const readiness = await Effect.runPromise(
    getRuntimeReadiness(source.runtime).pipe(Effect.provide(RuntimeProbeLive)),
  )
  if (readiness.status !== "Ready") throw new RuntimeNotReadyForReassessment(readiness.detail)

  const searchBrief = {
    location: source.location,
    ...(source.radiusKm === undefined ? {} : { radiusKm: source.radiusKm }),
    category: source.category,
    // The businesses are named, so the target is met once each has been re-scored.
    targetCount: 1,
    mode: source.mode,
    runtime: source.runtime,
    ...(source.runtimeConfiguration ? { runtimeConfiguration: source.runtimeConfiguration } : {}),
    recentBusinessPolicy: "Reassess" as const,
    reassessment: { discoveredBusinessIds: [input.discoveredBusinessId] },
    searchArea: source.searchArea,
  }

  return Effect.runPromise(
    startProspectingRun(searchBrief, crypto.randomUUID()).pipe(
      Effect.provide(sqliteProspectingRunRepositoryLive(loadLocalApplicationConfig().databasePath)),
    ),
  )
}

type ReassessableBrief = Readonly<{
  location: string
  radiusKm?: number
  category: string
  mode: "Quick" | "Thorough"
  runtime: "codex" | "claude" | "opencode"
  runtimeConfiguration?: unknown
  searchArea: unknown
}>

function reassessableBrief(value: unknown): ReassessableBrief | undefined {
  if (typeof value !== "object" || value === null) return undefined
  const brief = value as Readonly<Record<string, unknown>>
  const { location, category, mode, runtime, searchArea, radiusKm } = brief
  if (typeof location !== "string" || typeof category !== "string") return undefined
  if (mode !== "Quick" && mode !== "Thorough") return undefined
  if (typeof runtime !== "string" || !isRuntimeId(runtime)) return undefined
  if (typeof searchArea !== "object" || searchArea === null) return undefined
  return {
    location,
    ...(typeof radiusKm === "number" ? { radiusKm } : {}),
    category,
    mode,
    runtime,
    ...(brief.runtimeConfiguration ? { runtimeConfiguration: brief.runtimeConfiguration } : {}),
    searchArea,
  }
}

function hasActiveReassessment(discoveredBusinessId: string): boolean {
  const database = new Database(loadLocalApplicationConfig().databasePath, {
    readonly: true,
    fileMustExist: true,
  })
  try {
    return Boolean(
      database
        .prepare(
          `select 1 from prospecting_runs where state in ('Pending','Running')
           and exists (select 1 from json_each(json_extract(search_brief,'$.reassessment.discoveredBusinessIds'))
                       where value = ?) limit 1`,
        )
        .pluck()
        .get(discoveredBusinessId),
    )
  } finally {
    database.close()
  }
}
