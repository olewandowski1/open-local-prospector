import { Data, type Effect } from "effect"

import type { DiscoveryPage } from "@/features/business-discovery"
import type {
  IdentityEvaluation,
  IdentityEvidence,
} from "@/features/business-identity/domain/business-identity"
import type { SearchBrief } from "@/features/prospecting-runs"

export type IdentityTaskContext = Readonly<{
  discoveredBusinessId: string
  name: string
  resultUrl: string
  description?: string
  searchBrief: SearchBrief
  evidence: readonly IdentityEvidence[]
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
    /** Corroborated to a business this run already holds under a different discovered listing. */
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
  readonly hasCompletedQuery: (
    runId: string,
    discoveredBusinessId: string,
    query: string,
  ) => Effect.Effect<boolean, IdentityPersistenceError>
  readonly recordEvidenceQuery: (input: {
    runId: string
    taskId: string
    discoveredBusinessId: string
    source: string
    query: string
    page: DiscoveryPage
    collectedAt: Date
  }) => Effect.Effect<void, IdentityPersistenceError>
  readonly commitEvaluation: (input: {
    runId: string
    taskId: string
    discoveredBusinessId: string
    searchBrief: SearchBrief
    evaluation: IdentityEvaluation
    committedAt: Date
  }) => Effect.Effect<CommittedIdentity, IdentityPersistenceError>
}
