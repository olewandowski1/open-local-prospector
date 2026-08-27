import { Effect } from "effect"

import type { DiscoveryRepository } from "@/features/business-discovery/application/discovery-repository"
import type { SearchBrief } from "@/features/prospecting-runs"
import { type RunTask, type TaskCheckpoint, TaskExecutionError } from "@/features/run-execution"

export function makeReassessmentSeedTaskExecutor(repository: DiscoveryRepository) {
  return (task: RunTask): Effect.Effect<TaskCheckpoint, TaskExecutionError> =>
    Effect.gen(function* () {
      const searchBrief = readSearchBrief(task.input)
      const canonicalBusinessIds = searchBrief?.reassessment?.canonicalBusinessIds
      if (!canonicalBusinessIds || canonicalBusinessIds.length === 0) {
        return yield* Effect.fail(
          new TaskExecutionError({
            classification: "Permanent",
            code: "missing-reassessment-businesses",
            message: "The reassessment brief names no business to reassess.",
          }),
        )
      }

      const carried = yield* repository
        .carryForwardBusinesses({
          runId: task.runId,
          canonicalBusinessIds,
          carriedAt: new Date(),
        })
        .pipe(
          Effect.mapError(
            () =>
              new TaskExecutionError({
                classification: "Infrastructure",
                code: "reassessment-carry-forward",
                message: "The businesses to reassess could not be carried into this run.",
              }),
          ),
        )

      if (carried.length === 0) {
        // Structured discovery is what identity is recomputed from, so without it there is nothing to reassess.
        return yield* Effect.fail(
          new TaskExecutionError({
            classification: "Permanent",
            code: "reassessment-not-carried",
            message:
              "No named business had a structured discovery record to reassess. Discover it again instead.",
          }),
        )
      }

      return {
        value: {
          carriedBusinesses: carried.length,
          requestedBusinesses: canonicalBusinessIds.length,
          schemaVersion: 1,
        },
        nextTasks: carried.map((business) => ({
          stage: "CorroborateBusiness",
          businessId: business.discoveredBusinessId,
          input: { businessId: business.discoveredBusinessId },
          schemaVersion: 1,
        })),
      }
    })
}

function readSearchBrief(input: Readonly<Record<string, unknown>>): SearchBrief | undefined {
  const searchBrief = input.searchBrief
  return typeof searchBrief === "object" && searchBrief !== null
    ? (searchBrief as SearchBrief)
    : undefined
}
