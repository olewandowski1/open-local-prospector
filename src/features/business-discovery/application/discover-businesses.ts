import { Effect } from "effect"
import type { DiscoveryRepository } from "@/features/business-discovery/application/discovery-repository"
import type { DiscoverySource } from "@/features/business-discovery/application/discovery-source"
import type { SearchBrief } from "@/features/prospecting-runs"
import { type RunTask, type TaskCheckpoint, TaskExecutionError } from "@/features/run-execution"

const RESULTS_PER_PAGE = 20
const MAX_CONSECUTIVE_EMPTY_PAGES = 3

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
  const variations = [
    `${category} ${location}`,
    `${category} firma ${location}`,
    `${category} usługi ${location}`,
    `${category} kontakt ${location}`,
    `${category} Facebook ${location}`,
    `${category} Instagram ${location}`,
    `${category} katalog firm ${location}`,
    `${category} lokalna firma ${location}`,
  ]
  const queryLimit = searchBrief.mode === "Thorough" ? 8 : 4
  return {
    queries: [...new Set(variations.map(boundQuery))].slice(0, queryLimit),
    pagesPerQuery: 1,
  }
}

export function makeDiscoveryTaskExecutor(
  source: DiscoverySource,
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
      let consecutiveEmptyPages = 0
      let stoppedForRepeatedResults = false

      outer: for (const query of plan.queries) {
        for (let offset = 0; offset < plan.pagesPerQuery; offset += 1) {
          if (progress.uniqueBusinesses >= searchBrief.targetCount) break outer

          const completed = yield* repository
            .getCompletedPage(task.runId, query, offset)
            .pipe(Effect.mapError(persistenceError))
          if (completed) {
            if (!completed.moreResults) break
            continue
          }

          const page = yield* source
            .search({
              runtime: searchBrief.runtime,
              ...(searchBrief.runtimeConfiguration
                ? { runtimeConfiguration: searchBrief.runtimeConfiguration }
                : {}),
              query,
              count: RESULTS_PER_PAGE,
              offset,
              country: searchBrief.searchArea.countryCode,
              searchLanguage: searchBrief.searchArea.countryCode === "PL" ? "pl" : "en",
            })
            .pipe(
              Effect.mapError(
                (error) =>
                  new TaskExecutionError({
                    classification: error.classification,
                    code: error.code,
                    message: error.message,
                  }),
              ),
            )

          const recorded = yield* repository
            .recordPage({
              runId: task.runId,
              taskId: task.id,
              source: source.identifier,
              query,
              offset,
              page,
              targetCount: searchBrief.targetCount,
              recordedAt: new Date(),
            })
            .pipe(Effect.mapError(persistenceError))
          progress = recorded.progress
          consecutiveEmptyPages = recorded.uniqueAdded === 0 ? consecutiveEmptyPages + 1 : 0
          if (consecutiveEmptyPages >= MAX_CONSECUTIVE_EMPTY_PAGES) {
            stoppedForRepeatedResults = true
            break outer
          }
          if (!page.moreResults) break
        }
      }

      const targetReached = progress.uniqueBusinesses >= searchBrief.targetCount
      // Pursuing exactly the target left no headroom for downstream exclusions.
      return {
        value: {
          source: source.identifier,
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
