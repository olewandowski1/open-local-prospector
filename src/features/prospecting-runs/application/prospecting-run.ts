import { Context, Effect, type Option } from "effect"

import {
  decodeSearchBrief,
  type SearchBrief,
} from "@/features/prospecting-runs/domain/search-brief"

export type PendingProspectingRun = Readonly<{
  id: string
  requestId: string
  searchBrief: SearchBrief
  state: "Pending"
  createdAt: Date
}>

export type SearchBriefDefaults = Readonly<{
  radiusKm?: number
  category: string
  targetCount: number
  mode: SearchBrief["mode"]
}>

export interface ProspectingRunRepository {
  readonly createPending: (
    searchBrief: SearchBrief,
    requestId: string,
  ) => Effect.Effect<PendingProspectingRun>
  readonly getDefaults: Effect.Effect<Option.Option<SearchBriefDefaults>>
}

export class ProspectingRunRepositoryTag extends Context.Tag("ProspectingRunRepository")<
  ProspectingRunRepositoryTag,
  ProspectingRunRepository
>() {}

export const startProspectingRun = (input: unknown, requestId = crypto.randomUUID()) =>
  Effect.gen(function* () {
    const searchBrief = yield* decodeSearchBrief(input)
    const repository = yield* ProspectingRunRepositoryTag
    return yield* repository.createPending(searchBrief, requestId)
  })

export const getSearchBriefDefaults = Effect.flatMap(
  ProspectingRunRepositoryTag,
  (repository) => repository.getDefaults,
)
