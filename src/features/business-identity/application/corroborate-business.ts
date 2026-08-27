import { Effect } from "effect"

import type { IdentityRepository } from "@/features/business-identity/application/identity-repository"
import { evaluateBusinessIdentity } from "@/features/business-identity/domain/business-identity"
import { type RunTask, type TaskCheckpoint, TaskExecutionError } from "@/features/run-execution"

export function makeIdentityTaskExecutor(repository: IdentityRepository) {
  return (task: RunTask): Effect.Effect<TaskCheckpoint, TaskExecutionError> =>
    Effect.gen(function* () {
      const discoveredBusinessId = task.businessId ?? readBusinessId(task.input)
      if (!discoveredBusinessId) {
        return yield* permanent(
          "missing-discovered-business",
          "The identity task has no discovered business reference.",
        )
      }
      const context = yield* repository
        .loadContext(task.runId, discoveredBusinessId)
        .pipe(Effect.mapError(persistenceError))
      if (!context.structured) {
        // A missing report section identifies a row from before structured discovery.
        return yield* permanent(
          "missing-structured-business",
          "This business was discovered before structured attribution and cannot be corroborated.",
        )
      }

      const evaluation = evaluateBusinessIdentity({
        business: context.structured,
        countryCode: context.searchBrief.searchArea.countryCode,
        collectedAt: new Date(),
      })
      const committed = yield* repository
        .commitEvaluation({
          runId: task.runId,
          taskId: task.id,
          discoveredBusinessId,
          searchBrief: context.searchBrief,
          evaluation,
          committedAt: new Date(),
        })
        .pipe(Effect.mapError(persistenceError))

      return {
        value: {
          runBusinessId: committed.runBusinessId,
          ...(committed.canonicalBusinessId
            ? { canonicalBusinessId: committed.canonicalBusinessId }
            : {}),
          status: committed.status,
          identitySignals: evaluation.signals,
          onlinePresences: evaluation.presences.length,
          contactRoutes: evaluation.contacts.length,
          schemaVersion: 1,
        },
        ...(committed.shouldInspect
          ? {
              nextTasks: [
                {
                  stage: "InspectWebsite",
                  businessId: discoveredBusinessId,
                  input: {
                    runBusinessId: committed.runBusinessId,
                    canonicalBusinessId: committed.canonicalBusinessId,
                    ...(committed.websiteUrl ? { websiteUrl: committed.websiteUrl } : {}),
                  },
                  schemaVersion: 1,
                },
              ],
            }
          : {}),
      }
    })
}

function readBusinessId(input: Readonly<Record<string, unknown>>): string | undefined {
  const value = input.businessId
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function permanent(code: string, message: string) {
  return new TaskExecutionError({ classification: "Permanent", code, message })
}

function persistenceError() {
  return new TaskExecutionError({
    classification: "Infrastructure",
    code: "identity-persistence-failed",
    message: "The corroborated identity could not be persisted safely.",
  })
}
