import { Context, Data, Effect } from "effect"
import type { RuntimeId } from "@/features/prospecting-runs"
import type { BoundedRunList, RunDetail } from "@/features/run-monitoring/domain/run-progress"

export type RunControl = "Pause" | "Resume" | "Cancel"

export class RunMonitoringError extends Data.TaggedError("RunMonitoringError")<{
  readonly operation: "list" | "read" | "control"
}> {}

export interface RunReadRepositoryService {
  readonly list: (now: Date) => Effect.Effect<BoundedRunList, RunMonitoringError>
  readonly get: (runId: string) => Effect.Effect<RunDetail, RunMonitoringError>
}

export interface RunControlRepositoryService {
  readonly request: (
    runId: string,
    control: RunControl,
    runtime?: RuntimeId,
  ) => Effect.Effect<void, RunMonitoringError>
}

export class RunReadRepository extends Context.Tag("RunMonitoring/RunReadRepository")<
  RunReadRepository,
  RunReadRepositoryService
>() {}

export class RunControlRepository extends Context.Tag("RunMonitoring/RunControlRepository")<
  RunControlRepository,
  RunControlRepositoryService
>() {}

export const listRuns = (now = new Date()) =>
  RunReadRepository.pipe(Effect.flatMap((repository) => repository.list(now)))
export const getRun = (runId: string) =>
  RunReadRepository.pipe(Effect.flatMap((repository) => repository.get(runId)))
export const controlRun = (runId: string, control: RunControl, runtime?: RuntimeId) =>
  RunControlRepository.pipe(
    Effect.flatMap((repository) => repository.request(runId, control, runtime)),
  )
