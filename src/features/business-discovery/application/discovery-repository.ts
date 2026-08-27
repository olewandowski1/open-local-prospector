import { Data, type Effect } from "effect"

import type {
  StructuredBusiness,
  VerificationRejection,
} from "@/features/business-discovery/domain/discovery-structure"

export type DiscoveryProgress = Readonly<{
  uniqueBusinesses: number
  businessIds: readonly string[]
}>

export type CompletedDiscoveryPage = Readonly<{
  moreResults: boolean
}>

export type RecordedDiscoveryPage = Readonly<{
  uniqueAdded: number
  duplicates: number
  progress: DiscoveryProgress
}>

export type RecordReportInput = Readonly<{
  runId: string
  taskId: string
  source: string
  query: string
  report: string
  runtimeId: string
  runtimeModel?: string
  /** How many businesses the structuring step returned, before verification removed any. */
  returned: number
  businesses: readonly StructuredBusiness[]
  rejections: readonly VerificationRejection[]
  recordedAt: Date
}>

export class DiscoveryPersistenceError extends Data.TaggedError("DiscoveryPersistenceError")<{
  readonly operation: "progress" | "lookup-page" | "record-page" | "carry-forward"
}> {}

export type CarriedForwardBusiness = Readonly<{
  discoveredBusinessId: string
  name: string
}>

export interface DiscoveryRepository {
  readonly getProgress: (
    runId: string,
  ) => Effect.Effect<DiscoveryProgress, DiscoveryPersistenceError>
  readonly getCompletedPage: (
    runId: string,
    query: string,
    offset: number,
  ) => Effect.Effect<CompletedDiscoveryPage | undefined, DiscoveryPersistenceError>
  readonly recordReport: (
    input: RecordReportInput,
  ) => Effect.Effect<RecordedDiscoveryPage, DiscoveryPersistenceError>
  readonly carryForwardBusinesses: (
    input: Readonly<{
      runId: string
      canonicalBusinessIds: readonly string[]
      carriedAt: Date
    }>,
  ) => Effect.Effect<readonly CarriedForwardBusiness[], DiscoveryPersistenceError>
}
