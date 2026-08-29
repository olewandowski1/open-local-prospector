import { Effect } from "effect"

import {
  type DiscoveryRuntime,
  decodeDiscoveryStructure,
  normalizeDiscoveryUrl,
  verifyAgainstReport,
} from "@/features/business-discovery"
import type { IdentityRepository } from "@/features/business-identity/application/identity-repository"
import { normalizeWords } from "@/features/business-identity/domain/business-identity"
import { type RunTask, type TaskCheckpoint, TaskExecutionError } from "@/features/run-execution"
import { MINIMUM_ABSENCE_SOURCES } from "@/features/website-assessment"

/** An absent website outscores everything else, and one such claim in three was wrong. */
export function makeAbsenceConfirmationExecutor(
  repository: IdentityRepository,
  runtime: DiscoveryRuntime,
) {
  return (task: RunTask): Effect.Effect<TaskCheckpoint, TaskExecutionError> =>
    Effect.gen(function* () {
      const runBusinessId = readString(task.input, "runBusinessId")
      const inspectionId = readString(task.input, "inspectionId")
      if (!runBusinessId || !inspectionId) {
        return yield* permanent(
          "missing-inspection-reference",
          "The confirmation task names no inspected business.",
        )
      }
      const context = yield* repository
        .loadAbsenceContext(runBusinessId)
        .pipe(Effect.mapError(persistenceError))

      // Already corroborated, or confirmed once already: spend nothing and move on.
      const settled =
        context.corroboratingSources >= MINIMUM_ABSENCE_SOURCES ||
        readString(task.input, "absenceConfirmed") !== undefined
      if (settled) {
        return assess(task, inspectionId, runBusinessId, context.canonicalBusinessId, {
          confirmed: false,
          reason: "already-corroborated",
          sources: context.corroboratingSources,
        })
      }

      const brief = {
        runtime: context.searchBrief.runtime,
        ...(context.searchBrief.runtimeConfiguration
          ? { runtimeConfiguration: context.searchBrief.runtimeConfiguration }
          : {}),
        query: `${context.name} ${context.locality}`,
        category: context.searchBrief.category,
        searchAreaName: context.searchBrief.searchArea.displayName,
        countryCode: context.searchBrief.searchArea.countryCode,
        searchLanguage: context.searchBrief.searchArea.countryCode === "PL" ? "pl" : "en",
        wanted: 1,
      }
      const report = yield* runtime.report(brief).pipe(Effect.mapError(runtimeError))
      const structure = yield* runtime.structure(brief, report).pipe(Effect.mapError(runtimeError))
      const decoded = yield* decodeDiscoveryStructure(structure).pipe(
        Effect.mapError(() => runtimeFailure("unreadable-confirmation")),
      )
      const verified = verifyAgainstReport(
        decoded,
        report,
        context.searchBrief.searchArea.countryCode,
        (value: string) => normalizeDiscoveryUrl(value) !== undefined,
      )
      // The search answers about a market, so the first entry could be a neighbour's website.
      const wanted = normalizeWords(context.name)
      const found = verified.businesses.find((business) => normalizeWords(business.name) === wanted)
      const websiteUrl = found?.websiteUrl
      const pagesRead = [
        ...(found?.sourceUrls ?? []),
        ...(found?.presences ?? []).map((presence) => presence.url),
      ]

      yield* repository
        .recordAbsenceConfirmation({
          runBusinessId,
          canonicalBusinessId: context.canonicalBusinessId,
          pagesRead,
          ...(websiteUrl ? { websiteUrl } : {}),
          collectedAt: new Date(),
        })
        .pipe(Effect.mapError(persistenceError))

      // A website the first pass missed is worth inspecting rather than scoring as absent.
      if (websiteUrl) {
        return {
          value: {
            confirmed: false,
            websiteFound: true,
            pagesRead: pagesRead.length,
            schemaVersion: 1,
          },
          nextTasks: [
            {
              stage: "InspectWebsite",
              ...(task.businessId ? { businessId: task.businessId } : {}),
              input: {
                runBusinessId,
                canonicalBusinessId: context.canonicalBusinessId,
                websiteUrl,
                absenceConfirmed: "yes",
              },
              schemaVersion: 1,
            },
          ],
        }
      }

      return assess(task, inspectionId, runBusinessId, context.canonicalBusinessId, {
        confirmed: true,
        reason: "no-website-found",
        sources: context.corroboratingSources + new Set(pagesRead).size,
      })
    })
}

function assess(
  task: RunTask,
  inspectionId: string,
  runBusinessId: string,
  canonicalBusinessId: string,
  value: Readonly<Record<string, unknown>>,
): TaskCheckpoint {
  return {
    value: { ...value, schemaVersion: 1 },
    nextTasks: [
      {
        stage: "AssessWebsiteOpportunity",
        ...(task.businessId ? { businessId: task.businessId } : {}),
        input: { inspectionId, runBusinessId, canonicalBusinessId },
        schemaVersion: 1,
      },
    ],
  }
}

function readString(input: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = input[key]
  return typeof value === "string" && value.trim() ? value : undefined
}

function permanent(code: string, message: string) {
  return Effect.fail(new TaskExecutionError({ classification: "Permanent", code, message }))
}

function runtimeFailure(code: string) {
  return new TaskExecutionError({
    classification: "Transient",
    code,
    message: "The confirming search could not be read.",
  })
}

function runtimeError(error: { classification: string; code: string; message: string }) {
  return new TaskExecutionError({
    classification: error.classification === "Permanent" ? "Permanent" : "Transient",
    code: error.code,
    message: error.message,
  })
}

function persistenceError() {
  return new TaskExecutionError({
    classification: "Infrastructure",
    code: "absence-confirmation-persistence-failed",
    message: "The confirming search could not be recorded.",
  })
}
