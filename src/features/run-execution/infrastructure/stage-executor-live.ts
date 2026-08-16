import { Effect, Layer } from "effect"

import {
  StageExecutor,
  TaskExecutionError,
} from "@/features/run-execution/application/stage-executor"

export const StageExecutorLive = Layer.succeed(StageExecutor, {
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
      return Effect.fail(
        new TaskExecutionError({
          classification: "Blocked",
          code: "discovery-adapter-unavailable",
          message: "The Brave Search discovery stage is not installed yet.",
        }),
      )
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
