import { Data, type Effect } from "effect"

import type { SearchBrief } from "@/features/prospecting-runs"
import type { WebsiteInspectionResult } from "@/features/website-inspection/application/website-inspector"

export type InspectionTarget = Readonly<{
  runBusinessId: string
  canonicalBusinessId: string
  name: string
  searchBrief: SearchBrief
  websiteUrl?: string
}>

export class InspectionPersistenceError extends Data.TaggedError("InspectionPersistenceError")<{
  readonly operation: "load" | "commit"
}> {}

export interface InspectionRepository {
  readonly loadTarget: (
    runId: string,
    runBusinessId: string,
  ) => Effect.Effect<InspectionTarget, InspectionPersistenceError>
  readonly commit: (input: {
    runId: string
    taskId: string
    target: InspectionTarget
    result: WebsiteInspectionResult
  }) => Effect.Effect<string, InspectionPersistenceError>
}
