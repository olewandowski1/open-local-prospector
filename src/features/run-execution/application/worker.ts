import { Clock, Console, Effect, Option } from "effect"

import { RunTaskRepository } from "@/features/run-execution/application/run-task-repository"
import {
  StageExecutor,
  TaskExecutionError,
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
    yield* repository.recoverAbandoned(new Date(yield* Clock.currentTimeMillis))
    let claimed = 0

    const slot = Effect.gen(function* () {
      while (true) {
        const now = new Date(yield* Clock.currentTimeMillis)
        const task = yield* repository.claimNext(owner, now, configuration.leaseMilliseconds)
        if (Option.isNone(task)) return
        claimed += 1
        // One task's failure must not abandon the others, nor travel out of the cycle and end the process.
        yield* executeClaimedTask(task.value, owner, configuration).pipe(
          Effect.catchAll((error) =>
            Console.error(
              `Task ${task.value.id} (${task.value.stage}) could not be settled: ${error.operation}`,
            ),
          ),
        )
      }
    })

    yield* Effect.forEach(
      Array.from({ length: configuration.concurrency }, (_, index) => index),
      () => slot,
      { concurrency: configuration.concurrency, discard: true },
    )
    return claimed
  })

export const runWorker = (
  owner: string,
  configuration: WorkerConfiguration,
  acquireOperationLease: () => (() => void) | undefined = () => () => undefined,
  releaseDatabases: () => void = () => undefined,
) =>
  Effect.forever(
    Effect.acquireUseRelease(
      Effect.sync(acquireOperationLease),
      (release) =>
        release
          ? runWorkerCycle(owner, configuration)
          : // Maintenance holds the lease and is about to rename the database, which Windows refuses while this process has it open.
            Effect.sync(releaseDatabases).pipe(Effect.as(0 as number)),
      (release) => Effect.sync(() => release?.()),
    ).pipe(
      // A briefly unavailable database is not a reason to stop working; exiting here took the web process with it.
      Effect.catchAll((error) =>
        Console.error(`Worker cycle failed (${error.operation}); retrying.`).pipe(
          Effect.as(0 as number),
        ),
      ),
      Effect.flatMap((claimed) =>
        claimed === 0 ? Effect.sleep(configuration.pollMilliseconds) : Effect.void,
      ),
    ),
  )

function executeClaimedTask(task: RunTask, owner: string, configuration: WorkerConfiguration) {
  return Effect.gen(function* () {
    const repository = yield* RunTaskRepository
    const executor = yield* StageExecutor
    // Renewal races the work rather than running beside it, so losing the lease stops the work it protects.
    const renewLease = Effect.forever(
      Effect.sleep(Math.max(1_000, Math.floor(configuration.leaseMilliseconds / 3))).pipe(
        Effect.flatMap(() => Clock.currentTimeMillis),
        Effect.flatMap((now) =>
          repository.renewLease(task.id, owner, new Date(now), configuration.leaseMilliseconds),
        ),
      ),
    ).pipe(
      Effect.mapError(
        () =>
          new TaskExecutionError({
            classification: "Transient",
            code: "lease-lost",
            message: "The worker lost this task's lease while the stage was still running.",
          }),
      ),
    )
    const execution = yield* Effect.either(Effect.raceFirst(executor.execute(task), renewLease))
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
