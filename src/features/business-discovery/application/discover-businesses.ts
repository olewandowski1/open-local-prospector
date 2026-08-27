import { Effect } from "effect"
import type { DiscoveryRepository } from "@/features/business-discovery/application/discovery-repository"
import type {
  DiscoveryBrief,
  DiscoveryRuntime,
} from "@/features/business-discovery/application/discovery-runtime"
import { normalizeDiscoveryUrl } from "@/features/business-discovery/domain/discovered-business"
import { verifyAgainstReport } from "@/features/business-discovery/domain/discovery-structure"
import type { SearchBrief } from "@/features/prospecting-runs"
import { type RunTask, type TaskCheckpoint, TaskExecutionError } from "@/features/run-execution"

const MAX_CONSECUTIVE_EMPTY_REPORTS = 2

export type DiscoveryPlan = Readonly<{
  queries: readonly string[]
  pagesPerQuery: number
}>

export function planDiscoveryQueries(searchBrief: SearchBrief): DiscoveryPlan {
  const locality =
    searchBrief.searchArea.displayName.split(",")[0] ?? searchBrief.searchArea.displayName
  const location =
    searchBrief.radiusKm === undefined
      ? locality
      : `w promieniu ${searchBrief.radiusKm} km od ${locality}`
  const category = searchBrief.category
  // Each report searches several angles because runtime search has no stable pagination.
  const variations = [
    `${category} ${location}`,
    `${category} kontakt ${location}`,
    `${category} Facebook Instagram ${location}`,
    `${category} katalog firm ${location}`,
  ]
  const queryLimit = searchBrief.mode === "Thorough" ? 4 : 2
  return {
    queries: [...new Set(variations.map(boundQuery))].slice(0, queryLimit),
    pagesPerQuery: 1,
  }
}

export function makeDiscoveryTaskExecutor(
  runtime: DiscoveryRuntime,
  repository: DiscoveryRepository,
) {
  return (task: RunTask): Effect.Effect<TaskCheckpoint, TaskExecutionError> =>
    Effect.gen(function* () {
      const searchBrief = readSearchBrief(task.input)
      if (!searchBrief) {
        return yield* new TaskExecutionError({
          classification: "Permanent",
          code: "invalid-search-brief",
          message: "The persisted discovery input is not a valid Search Brief.",
        })
      }

      const plan = planDiscoveryQueries(searchBrief)
      let progress = yield* repository
        .getProgress(task.runId)
        .pipe(Effect.mapError(persistenceError))
      let consecutiveEmptyReports = 0
      let stoppedForRepeatedResults = false

      for (const query of plan.queries) {
        if (progress.uniqueBusinesses >= searchBrief.targetCount) break

        const completed = yield* repository
          .getCompletedPage(task.runId, query, 0)
          .pipe(Effect.mapError(persistenceError))
        if (completed) continue

        const brief = discoveryBrief(searchBrief, query)
        const report = yield* runtime.report(brief).pipe(Effect.mapError(runtimeError))
        const structure = yield* runtime
          .structure(brief, report)
          .pipe(Effect.mapError(runtimeError))
        const verified = verifyAgainstReport(
          structure,
          report,
          searchBrief.searchArea.countryCode,
          isPublicUrl,
        )

        const recorded = yield* repository
          .recordReport({
            runId: task.runId,
            taskId: task.id,
            source: runtime.identifier,
            query,
            report,
            runtimeId: searchBrief.runtime,
            ...(searchBrief.runtimeConfiguration
              ? { runtimeModel: searchBrief.runtimeConfiguration.model }
              : {}),
            returned: structure.businesses.length,
            businesses: verified.businesses,
            rejections: verified.rejections,
            recordedAt: new Date(),
          })
          .pipe(Effect.mapError(persistenceError))
        progress = recorded.progress
        consecutiveEmptyReports = recorded.uniqueAdded === 0 ? consecutiveEmptyReports + 1 : 0
        if (consecutiveEmptyReports >= MAX_CONSECUTIVE_EMPTY_REPORTS) {
          stoppedForRepeatedResults = true
          break
        }
      }

      const targetReached = progress.uniqueBusinesses >= searchBrief.targetCount
      // Pursuing exactly the target left no headroom for downstream exclusions.
      return {
        value: {
          source: runtime.identifier,
          discoveredBusinesses: progress.uniqueBusinesses,
          targetCount: searchBrief.targetCount,
          targetReached,
          searchExhausted: !targetReached,
          stoppedForRepeatedResults,
          schemaVersion: 1,
        },
        ...(progress.uniqueBusinesses > 0
          ? {
              nextTasks: progress.businessIds.map((businessId) => ({
                stage: "CorroborateBusiness",
                businessId,
                input: { businessId },
                schemaVersion: 1,
              })),
            }
          : { completionState: "Search Exhausted" as const }),
      }
    })
}

function discoveryBrief(searchBrief: SearchBrief, query: string): DiscoveryBrief {
  return {
    runtime: searchBrief.runtime,
    ...(searchBrief.runtimeConfiguration
      ? { runtimeConfiguration: searchBrief.runtimeConfiguration }
      : {}),
    query,
    category: searchBrief.category,
    searchAreaName: searchBrief.searchArea.displayName,
    countryCode: searchBrief.searchArea.countryCode,
    searchLanguage: searchBrief.searchArea.countryCode === "PL" ? "pl" : "en",
    wanted: Math.max(searchBrief.targetCount, 10),
  }
}

function isPublicUrl(value: string): boolean {
  return normalizeDiscoveryUrl(value) !== undefined
}

function runtimeError(error: {
  classification: "Transient" | "Permanent" | "Blocked" | "Infrastructure"
  code: string
  message: string
}) {
  return new TaskExecutionError({
    classification: error.classification,
    code: error.code,
    message: error.message,
  })
}

function persistenceError() {
  return new TaskExecutionError({
    classification: "Infrastructure",
    code: "discovery-persistence-failed",
    message: "Discovery progress could not be persisted safely.",
  })
}
function boundQuery(value: string): string {
  const words = value.trim().split(/\s+/u).slice(0, 50)
  let result = words.join(" ")
  while (result.length > 400 && words.length > 1) {
    words.pop()
    result = words.join(" ")
  }
  return result.slice(0, 400)
}

function readSearchBrief(input: Readonly<Record<string, unknown>>): SearchBrief | undefined {
  const value = input.searchBrief
  if (!isRecord(value) || !isRecord(value.searchArea)) return undefined
  if (
    typeof value.category !== "string" ||
    typeof value.targetCount !== "number" ||
    (value.mode !== "Quick" && value.mode !== "Thorough") ||
    typeof value.searchArea.displayName !== "string" ||
    typeof value.searchArea.countryCode !== "string"
  ) {
    return undefined
  }
  return value as SearchBrief
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
