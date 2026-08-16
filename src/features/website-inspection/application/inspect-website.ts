import { isAbsolute, relative, resolve } from "node:path"

import { Effect } from "effect"

import { type RunTask, type TaskCheckpoint, TaskExecutionError } from "@/features/run-execution"
import type { InspectionRepository } from "@/features/website-inspection/application/inspection-repository"
import type {
  WebsiteInspectionResult,
  WebsiteInspector,
} from "@/features/website-inspection/application/website-inspector"

export function makeInspectionTaskExecutor(
  inspector: WebsiteInspector,
  repository: InspectionRepository,
  artifactsRoot: string,
) {
  const absoluteArtifactsRoot = resolve(artifactsRoot)
  return (task: RunTask): Effect.Effect<TaskCheckpoint, TaskExecutionError> =>
    Effect.gen(function* () {
      const runBusinessId = readString(task.input, "runBusinessId")
      if (!runBusinessId) {
        return yield* permanent(
          "missing-run-business",
          "The inspection task has no run-business reference.",
        )
      }
      const target = yield* repository
        .loadTarget(task.runId, runBusinessId)
        .pipe(Effect.mapError(persistenceError))
      const result = target.websiteUrl
        ? yield* inspector
            .inspect({
              url: target.websiteUrl,
              artifactDirectory: safeArtifactDirectory(absoluteArtifactsRoot, task.runId, task.id),
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
        : noWebsiteResult()
      const inspectionId = yield* repository
        .commit({ runId: task.runId, taskId: task.id, target, result })
        .pipe(Effect.mapError(persistenceError))
      return {
        value: {
          inspectionId,
          status: result.status,
          pages: result.pages.length,
          blocks: result.blocks.length,
          configurationVersion: result.configurationVersion,
          schemaVersion: 1,
        },
        nextTasks: [
          {
            stage: "AssessWebsiteOpportunity",
            businessId: task.businessId,
            input: {
              inspectionId,
              runBusinessId,
              canonicalBusinessId: target.canonicalBusinessId,
            },
            schemaVersion: 1,
          },
        ],
      }
    })
}

function safeArtifactDirectory(root: string, runId: string, taskId: string): string {
  const safePart = (value: string) => value.replace(/[^a-zA-Z0-9_-]/gu, "_").slice(0, 100)
  const target = resolve(root, "inspections", safePart(runId), safePart(taskId))
  const relation = relative(root, target)
  if (relation.startsWith("..") || isAbsolute(relation)) {
    throw new Error("artifact path escaped configured root")
  }
  return target
}

function noWebsiteResult(): WebsiteInspectionResult {
  const now = new Date()
  return {
    status: "NoWebsite",
    pages: [],
    blocks: [],
    startedAt: now,
    completedAt: now,
    configurationVersion: "quick-v1",
  }
}

function readString(input: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = input[key]
  return typeof value === "string" && value.trim() ? value : undefined
}

function persistenceError() {
  return new TaskExecutionError({
    classification: "Infrastructure",
    code: "inspection-persistence-failed",
    message: "Website inspection evidence could not be persisted safely.",
  })
}

function permanent(code: string, message: string) {
  return new TaskExecutionError({ classification: "Permanent", code, message })
}
