import { Effect } from "effect"

import type { RunTask, TaskCheckpoint } from "@/features/run-execution"
import { TaskExecutionError } from "@/features/run-execution"
import type { AssessmentRepository } from "@/features/website-assessment/application/assessment-repository"
import type { AssessmentRuntime } from "@/features/website-assessment/application/assessment-runtime"

export function makeAssessmentTaskExecutor(
  repository: AssessmentRepository,
  runtimes: Readonly<Record<string, AssessmentRuntime | undefined>>,
) {
  return (task: RunTask): Effect.Effect<TaskCheckpoint, TaskExecutionError> =>
    Effect.gen(function* () {
      const target = yield* repository
        .loadTarget(task.runId, task.id, task.input)
        .pipe(
          Effect.mapError(() =>
            failure(
              "Infrastructure",
              "assessment-load",
              "Assessment evidence could not be loaded.",
            ),
          ),
        )
      const runtime = runtimes[target.runtimeId]
      if (!runtime)
        return yield* failure(
          "Blocked",
          "runtime-unavailable",
          `The selected ${target.runtimeId} subscription runtime is not available.`,
        )
      const output = yield* runtime
        .assess(target.evidence, target.runtimeConfiguration, target.screenshots)
        .pipe(Effect.mapError((error) => failure(error.classification, error.code, error.message)))
      const assessmentId = yield* repository
        .commit(target, output, runtime.version)
        .pipe(
          Effect.mapError(() =>
            failure(
              "Infrastructure",
              "assessment-commit",
              "The validated assessment could not be committed.",
            ),
          ),
        )
      return {
        value: {
          assessmentId,
          assessmentState: output.assessmentState,
          opportunities: output.opportunities.length,
          schemaVersion: 1,
        },
        nextTasks: [
          {
            stage: "ScoreCandidate",
            businessId: task.businessId,
            input: {
              assessmentId,
              runBusinessId: target.runBusinessId,
              canonicalBusinessId: target.canonicalBusinessId,
            },
            schemaVersion: 1,
          },
        ],
      }
    })
}

function failure(
  classification: TaskExecutionError["classification"],
  code: string,
  message: string,
) {
  return new TaskExecutionError({ classification, code, message })
}
