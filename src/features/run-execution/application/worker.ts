import { Clock, Effect, Option } from "effect"

import { RunTaskRepository } from "@/features/run-execution/application/run-task-repository"
import {
  StageExecutor,
  type TaskExecutionError,
} from "@/features/run-execution/application/stage-executor"
import type { RunTask, StructuredTaskFailure } from "@/features/run-execution/domain/run-task"

export type WorkerConfiguration = Readonly<{
  concurrency: number
  leaseMilliseconds: number
  pollMilliseconds: number
}>

export function loadWorkerConfiguration(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): WorkerConfiguration {
  const rawConcurrency = environment.PROSPECTOR_BUSINESS_CONCURRENCY?.trim()
  const concurrency = rawConcurrency ? Number(rawConcurrency) : 2
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
    throw new Error("PROSPECTOR_BUSINESS_CONCURRENCY must be an integer from 1 through 4.")
  }
  return { concurrency, leaseMilliseconds: 30_000, pollMilliseconds: 500 }
}

export const runWorkerCycle = (owner: string, configuration: WorkerConfiguration) =>
  Effect.gen(function* () {
    const repository = yield* RunTaskRepository
    const now = new Date(yield* Clock.currentTimeMillis)
    yield* repository.recoverAbandoned(now)
    const claimed: RunTask[] = []
    for (let index = 0; index < configuration.concurrency; index += 1) {
      const task = yield* repository.claimNext(owner, now, configuration.leaseMilliseconds)
      if (Option.isNone(task)) break
      claimed.push(task.value)
    }
    yield* Effect.forEach(claimed, (task) => executeClaimedTask(task, owner, configuration), {
      concurrency: configuration.concurrency,
      discard: true,
    })
    return claimed.length
  })

export const runWorker = (owner: string, configuration: WorkerConfiguration) =>
  Effect.forever(
    runWorkerCycle(owner, configuration).pipe(
      Effect.flatMap((claimed) =>
        claimed === 0 ? Effect.sleep(configuration.pollMilliseconds) : Effect.void,
      ),
    ),
  )

function executeClaimedTask(task: RunTask, owner: string, configuration: WorkerConfiguration) {
  return Effect.gen(function* () {
    const repository = yield* RunTaskRepository
    const executor = yield* StageExecutor
    const execution = yield* Effect.either(
      Effect.scoped(
        Effect.gen(function* () {
          yield* Effect.forkScoped(
            Effect.forever(
              Effect.sleep(Math.max(1_000, Math.floor(configuration.leaseMilliseconds / 3))).pipe(
                Effect.flatMap(() => Clock.currentTimeMillis),
                Effect.flatMap((now) =>
                  repository.renewLease(
                    task.id,
                    owner,
                    new Date(now),
                    configuration.leaseMilliseconds,
                  ),
                ),
              ),
            ),
          )
          return yield* executor.execute(task)
        }),
      ),
    )
    const completedAt = new Date(yield* Clock.currentTimeMillis)
    if (execution._tag === "Right") {
      yield* repository.complete(task, owner, execution.right, completedAt)
    } else {
      yield* repository.fail(
        task,
        owner,
        structuredFailure(execution.left, completedAt),
        completedAt,
      )
    }
  })
}

function structuredFailure(error: TaskExecutionError, occurredAt: Date): StructuredTaskFailure {
  return {
    classification: error.classification,
    code: error.code,
    message: error.message,
    occurredAt: occurredAt.toISOString(),
  }
}
