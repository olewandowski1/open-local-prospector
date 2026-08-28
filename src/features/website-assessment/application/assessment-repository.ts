import { Data, type Effect } from "effect"
import type { RuntimeExecutionConfiguration } from "@/features/runtime-settings"
import type {
  AssessmentEvidenceEnvelope,
  AssessmentScreenshot,
} from "@/features/website-assessment/application/assessment-runtime"
import type { AssessmentOutput } from "@/features/website-assessment/domain/assessment-output"

export type AssessmentTarget = Readonly<{
  runId: string
  taskId: string
  runBusinessId: string
  canonicalBusinessId: string
  inspectionId: string
  runtimeId: "codex" | "claude" | "opencode"
  runtimeConfiguration?: RuntimeExecutionConfiguration
  inspectionConfigurationVersion: string
  evidence: AssessmentEvidenceEnvelope
  screenshots: readonly AssessmentScreenshot[]
}>

export class AssessmentPersistenceError extends Data.TaggedError("AssessmentPersistenceError")<{
  readonly operation: "load" | "commit"
}> {}

export interface AssessmentRepository {
  loadTarget(
    runId: string,
    taskId: string,
    input: Readonly<Record<string, unknown>>,
  ): Effect.Effect<AssessmentTarget, AssessmentPersistenceError>
  commit(
    target: AssessmentTarget,
    output: AssessmentOutput,
    runtimeVersion?: string,
  ): Effect.Effect<string, AssessmentPersistenceError>
}
