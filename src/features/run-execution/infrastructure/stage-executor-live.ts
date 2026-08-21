import { Effect, Layer } from "effect"

import {
  StageExecutor,
  TaskExecutionError,
} from "@/features/run-execution/application/stage-executor"
import type { RunTask, TaskCheckpoint } from "@/features/run-execution/domain/run-task"

export type StageTaskExecutor = (task: RunTask) => Effect.Effect<TaskCheckpoint, TaskExecutionError>

/**
 * The stages this worker can run, named. Previously five positional parameters, all optional, paired
 * with an if-cascade that repeated each stage name and re-checked that its executor had been passed —
 * so a caller could put assessment where inspection belonged and nothing would say so.
 */
export type StageExecutors = Readonly<{
  DiscoverBusinesses: StageTaskExecutor
  CorroborateBusiness: StageTaskExecutor
  InspectWebsite: StageTaskExecutor
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
  return Effect.succeed({
    value: { planned: true, schemaVersion: 1, targetCount: searchBriefTarget(task.input) },
    nextTasks: [{ stage: "DiscoverBusinesses", input: task.input, schemaVersion: 1 }],
  })
}

function searchBriefTarget(input: Readonly<Record<string, unknown>>): number | undefined {
  const searchBrief = input.searchBrief
  if (typeof searchBrief !== "object" || searchBrief === null || !("targetCount" in searchBrief)) {
    return undefined
  }
  return typeof searchBrief.targetCount === "number" ? searchBrief.targetCount : undefined
}
