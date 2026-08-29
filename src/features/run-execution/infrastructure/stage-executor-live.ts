import { Effect, Layer } from "effect"

import {
  StageExecutor,
  TaskExecutionError,
} from "@/features/run-execution/application/stage-executor"
import type { RunTask, TaskCheckpoint } from "@/features/run-execution/domain/run-task"

export type StageTaskExecutor = (task: RunTask) => Effect.Effect<TaskCheckpoint, TaskExecutionError>

export type StageExecutors = Readonly<{
  SeedReassessment: StageTaskExecutor
  DiscoverBusinesses: StageTaskExecutor
  CorroborateBusiness: StageTaskExecutor
  InspectWebsite: StageTaskExecutor
  ConfirmAbsentWebsite: StageTaskExecutor
  AssessWebsiteOpportunity: StageTaskExecutor
  ScoreCandidate: StageTaskExecutor
}>

export const stageExecutorLive = (executors: StageExecutors) =>
  Layer.succeed(StageExecutor, {
    execute: (task) => {
      // Planning owns no adapter: it reads the brief already on the task and opens discovery.
      if (task.stage === "RunPlanning") return planRun(task)
      const execute = (executors as Readonly<Record<string, StageTaskExecutor | undefined>>)[
        task.stage
      ]
      return execute
        ? execute(task)
        : Effect.fail(
            new TaskExecutionError({
              classification: "Permanent",
              code: "unsupported-stage",
              message: `No application-owned executor is registered for ${task.stage}.`,
            }),
          )
    },
  })

function planRun(task: RunTask): Effect.Effect<TaskCheckpoint, TaskExecutionError> {
  // A reassessment already names its businesses, so it carries them forward instead of searching.
  const stage = namesReassessedBusinesses(task.input) ? "SeedReassessment" : "DiscoverBusinesses"
  return Effect.succeed({
    value: { planned: true, schemaVersion: 1, targetCount: searchBriefTarget(task.input) },
    nextTasks: [{ stage, input: task.input, schemaVersion: 1 }],
  })
}

function namesReassessedBusinesses(input: Readonly<Record<string, unknown>>): boolean {
  const searchBrief = input.searchBrief
  if (typeof searchBrief !== "object" || searchBrief === null) return false
  const reassessment = (searchBrief as Readonly<Record<string, unknown>>).reassessment
  if (typeof reassessment !== "object" || reassessment === null) return false
  const ids = (reassessment as Readonly<Record<string, unknown>>).discoveredBusinessIds
  return Array.isArray(ids) && ids.length > 0
}

function searchBriefTarget(input: Readonly<Record<string, unknown>>): number | undefined {
  const searchBrief = input.searchBrief
  if (typeof searchBrief !== "object" || searchBrief === null || !("targetCount" in searchBrief)) {
    return undefined
  }
  return typeof searchBrief.targetCount === "number" ? searchBrief.targetCount : undefined
}
