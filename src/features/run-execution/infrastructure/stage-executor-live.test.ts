import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import { StageExecutor } from "@/features/run-execution/application/stage-executor"
import type { RunTask } from "@/features/run-execution/domain/run-task"
import { stageExecutorLive } from "@/features/run-execution/infrastructure/stage-executor-live"

const unreachable = () => Effect.die("stage should not run")
const executors = {
  SeedReassessment: unreachable,
  DiscoverBusinesses: unreachable,
  CorroborateBusiness: unreachable,
  InspectWebsite: unreachable,
  ConfirmAbsentWebsite: unreachable,
  AssessWebsiteOpportunity: unreachable,
  ScoreCandidate: unreachable,
}

function planningTask(searchBrief: Readonly<Record<string, unknown>>): RunTask {
  return {
    id: "task-1",
    runId: "run-1",
    stage: "RunPlanning",
    status: "Leased",
    attemptCount: 1,
    maxAttempts: 3,
    input: { searchBrief },
    schemaVersion: 1,
    version: 1,
  }
}

const plan = (searchBrief: Readonly<Record<string, unknown>>) =>
  Effect.runPromise(
    Effect.flatMap(StageExecutor, (executor) => executor.execute(planningTask(searchBrief))).pipe(
      Effect.provide(stageExecutorLive(executors)),
    ),
  )

describe("run planning", () => {
  it("opens discovery for a search brief", async () => {
    const checkpoint = await plan({ targetCount: 10 })
    expect(checkpoint.nextTasks).toEqual([
      {
        stage: "DiscoverBusinesses",
        input: { searchBrief: { targetCount: 10 } },
        schemaVersion: 1,
      },
    ])
  })

  // The named businesses are already known, so searching for them again would be a wasted call.
  it("carries named businesses forward instead of searching for them", async () => {
    const searchBrief = {
      targetCount: 1,
      reassessment: { discoveredBusinessIds: ["discovered-1"] },
    }
    const checkpoint = await plan(searchBrief)
    expect(checkpoint.nextTasks?.[0]?.stage).toBe("SeedReassessment")
  })

  it("opens discovery when a reassessment names nothing", async () => {
    const checkpoint = await plan({ targetCount: 10, reassessment: { discoveredBusinessIds: [] } })
    expect(checkpoint.nextTasks?.[0]?.stage).toBe("DiscoverBusinesses")
  })
})
