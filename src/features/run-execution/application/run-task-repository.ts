import { Context, Data, type Effect, type Option } from "effect"

import type {
  RunTask,
  StructuredTaskFailure,
  TaskCheckpoint,
} from "@/features/run-execution/domain/run-task"

export class RunTaskPersistenceError extends Data.TaggedError("RunTaskPersistenceError")<{
  readonly operation: "recover" | "claim" | "renew" | "complete" | "fail"
}> {}

export interface RunTaskRepositoryService {
  readonly recoverAbandoned: (now: Date) => Effect.Effect<number, RunTaskPersistenceError>
  readonly claimNext: (
    owner: string,
    now: Date,
    leaseMilliseconds: number,
  ) => Effect.Effect<Option.Option<RunTask>, RunTaskPersistenceError>
  readonly renewLease: (
    taskId: string,
    owner: string,
    now: Date,
    leaseMilliseconds: number,
  ) => Effect.Effect<void, RunTaskPersistenceError>
  readonly complete: (
    task: RunTask,
    owner: string,
    checkpoint: TaskCheckpoint,
    now: Date,
  ) => Effect.Effect<void, RunTaskPersistenceError>
  readonly fail: (
    task: RunTask,
    owner: string,
    failure: StructuredTaskFailure,
    now: Date,
  ) => Effect.Effect<void, RunTaskPersistenceError>
}

export class RunTaskRepository extends Context.Tag("RunExecution/RunTaskRepository")<
  RunTaskRepository,
  RunTaskRepositoryService
>() {}
