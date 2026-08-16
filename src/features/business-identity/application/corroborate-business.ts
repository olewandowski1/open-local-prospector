import { Effect } from "effect"

import type { DiscoverySource } from "@/features/business-discovery"
import type { IdentityRepository } from "@/features/business-identity/application/identity-repository"
import { evaluateBusinessIdentity } from "@/features/business-identity/domain/business-identity"
import { type RunTask, type TaskCheckpoint, TaskExecutionError } from "@/features/run-execution"

export function makeIdentityTaskExecutor(source: DiscoverySource, repository: IdentityRepository) {
  return (task: RunTask): Effect.Effect<TaskCheckpoint, TaskExecutionError> =>
    Effect.gen(function* () {
      const discoveredBusinessId = task.businessId ?? readBusinessId(task.input)
      if (!discoveredBusinessId) {
        return yield* permanent(
          "missing-discovered-business",
          "The identity task has no discovered business reference.",
        )
      }
      let context = yield* repository
        .loadContext(task.runId, discoveredBusinessId)
        .pipe(Effect.mapError(persistenceError))
      const queries = evidenceQueries(
        context.name,
        context.searchBrief.searchArea.displayName,
        context.searchBrief.mode,
      )
      for (const query of queries) {
        const completed = yield* repository
          .hasCompletedQuery(task.runId, discoveredBusinessId, query)
          .pipe(Effect.mapError(persistenceError))
        if (completed) continue
        const page = yield* source
          .search({
            runtime: context.searchBrief.runtime,
            query,
            count: 10,
            offset: 0,
            country: context.searchBrief.searchArea.countryCode,
            searchLanguage: context.searchBrief.searchArea.countryCode === "PL" ? "pl" : "en",
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
        yield* repository
          .recordEvidenceQuery({
            runId: task.runId,
            taskId: task.id,
            discoveredBusinessId,
            source: source.identifier,
            query,
            page,
            collectedAt: new Date(),
          })
          .pipe(Effect.mapError(persistenceError))
      }
      context = yield* repository
        .loadContext(task.runId, discoveredBusinessId)
        .pipe(Effect.mapError(persistenceError))
      const evaluation = evaluateBusinessIdentity({
        name: context.name,
        searchAreaName: context.searchBrief.searchArea.displayName,
        countryCode: context.searchBrief.searchArea.countryCode,
        evidence: context.evidence,
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

export function evidenceQueries(name: string, searchAreaName: string, mode: "Quick" | "Thorough") {
  const locality = searchAreaName.split(",")[0]?.trim() ?? searchAreaName
  const queries = [
    `"${name}" "${locality}" kontakt`,
    `"${name}" "${locality}" strona Facebook Instagram`,
    `"${name}" "${locality}" adres telefon`,
  ]
  return queries.slice(0, mode === "Thorough" ? 3 : 2).map(boundQuery)
}

function boundQuery(value: string): string {
  const words = value.trim().split(/\s+/u).slice(0, 50)
  let query = words.join(" ")
  while (query.length > 400 && words.length > 1) {
    words.pop()
    query = words.join(" ")
  }
  return query.slice(0, 400)
}

function readBusinessId(input: Readonly<Record<string, unknown>>): string | undefined {
  return typeof input.businessId === "string" && input.businessId.trim()
    ? input.businessId
    : undefined
}

function persistenceError() {
  return new TaskExecutionError({
    classification: "Infrastructure",
    code: "identity-persistence-failed",
    message: "Business identity evidence could not be persisted safely.",
  })
}

function permanent(code: string, message: string) {
  return new TaskExecutionError({ classification: "Permanent", code, message })
}
