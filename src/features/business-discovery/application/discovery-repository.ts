import { Data, type Effect } from "effect"

import type { DiscoveryPage } from "@/features/business-discovery/domain/discovered-business"

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

export class DiscoveryPersistenceError extends Data.TaggedError("DiscoveryPersistenceError")<{
  readonly operation: "progress" | "lookup-page" | "record-page"
}> {}

export interface DiscoveryRepository {
  readonly getProgress: (
    runId: string,
  ) => Effect.Effect<DiscoveryProgress, DiscoveryPersistenceError>
  readonly getCompletedPage: (
    runId: string,
    query: string,
    offset: number,
  ) => Effect.Effect<CompletedDiscoveryPage | undefined, DiscoveryPersistenceError>
  readonly recordPage: (input: {
    runId: string
    taskId: string
    source: string
    query: string
    offset: number
    page: DiscoveryPage
    targetCount: number
    recordedAt: Date
  }) => Effect.Effect<RecordedDiscoveryPage, DiscoveryPersistenceError>
}
