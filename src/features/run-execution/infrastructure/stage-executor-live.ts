import { Effect, Layer } from "effect"

import {
  StageExecutor,
  TaskExecutionError,
} from "@/features/run-execution/application/stage-executor"
import type { RunTask, TaskCheckpoint } from "@/features/run-execution/domain/run-task"

type DiscoveryTaskExecutor = (task: RunTask) => Effect.Effect<TaskCheckpoint, TaskExecutionError>

export const stageExecutorLive = (executeDiscovery: DiscoveryTaskExecutor) =>
  Layer.succeed(StageExecutor, {
    execute: (task) => {
      if (task.stage === "RunPlanning") {
        return Effect.succeed({
          value: {
            planned: true,
            schemaVersion: 1,
            targetCount: searchBriefTarget(task.input),
          },
          nextTasks: [{ stage: "DiscoverBusinesses", input: task.input, schemaVersion: 1 }],
        })
      }
      if (task.stage === "DiscoverBusinesses") {
        return executeDiscovery(task)
      }
      return Effect.fail(
        new TaskExecutionError({
          classification: "Permanent",
          code: "unsupported-stage",
          message: `No application-owned executor is registered for ${task.stage}.`,
        }),
      )
    },
  })

function searchBriefTarget(input: Readonly<Record<string, unknown>>): number | undefined {
  const searchBrief = input.searchBrief
  if (typeof searchBrief !== "object" || searchBrief === null || !("targetCount" in searchBrief)) {
    return undefined
  }
  return typeof searchBrief.targetCount === "number" ? searchBrief.targetCount : undefined
}
