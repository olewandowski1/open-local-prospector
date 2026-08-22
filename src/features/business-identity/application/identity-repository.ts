import { Data, type Effect } from "effect"

import type { StructuredBusiness } from "@/features/business-discovery"
import type { IdentityEvaluation } from "@/features/business-identity/domain/business-identity"
import type { SearchBrief } from "@/features/prospecting-runs"

export type IdentityTaskContext = Readonly<{
  discoveredBusinessId: string
  name: string
  resultUrl: string
  description?: string
  searchBrief: SearchBrief
  structured?: StructuredBusiness
}>

export type CommittedIdentity = Readonly<{
  runBusinessId: string
  canonicalBusinessId?: string
  status:
    | "Eligible"
    | "Ambiguous"
    | "Excluded"
    | "SkippedRecent"
    | "IncludedRecent"
    | "DuplicateCandidate"
  websiteUrl?: string
  shouldInspect: boolean
}>

export class IdentityPersistenceError extends Data.TaggedError("IdentityPersistenceError")<{
  readonly operation: "load" | "lookup-query" | "record-query" | "commit"
}> {}

export interface IdentityRepository {
  readonly loadContext: (
    runId: string,
    discoveredBusinessId: string,
  ) => Effect.Effect<IdentityTaskContext, IdentityPersistenceError>
  readonly commitEvaluation: (input: {
    runId: string
    taskId: string
    discoveredBusinessId: string
    searchBrief: SearchBrief
    evaluation: IdentityEvaluation
    committedAt: Date
  }) => Effect.Effect<CommittedIdentity, IdentityPersistenceError>
}
