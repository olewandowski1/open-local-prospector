import { Context, Data, type Effect } from "effect"

import type { RunTask, TaskCheckpoint } from "@/features/run-execution/domain/run-task"

export class TaskExecutionError extends Data.TaggedError("TaskExecutionError")<{
  readonly classification: "Transient" | "Permanent" | "Blocked" | "Cancelled" | "Infrastructure"
  readonly code: string
  readonly message: string
}> {}

export interface StageExecutorService {
  readonly execute: (task: RunTask) => Effect.Effect<TaskCheckpoint, TaskExecutionError>
}

export class StageExecutor extends Context.Tag("RunExecution/StageExecutor")<
  StageExecutor,
  StageExecutorService
>() {}
