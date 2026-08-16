import { Context, Effect } from "effect"

import {
  decodeSearchBrief,
  type SearchBrief,
} from "@/features/prospecting-runs/domain/search-brief"

export type PendingProspectingRun = Readonly<{
  id: string
  searchBrief: SearchBrief
  state: "Pending"
}>

export interface ProspectingRunRepository {
  readonly createPending: (searchBrief: SearchBrief) => Effect.Effect<PendingProspectingRun>
}

export class ProspectingRunRepositoryTag extends Context.Tag("ProspectingRunRepository")<
  ProspectingRunRepositoryTag,
  ProspectingRunRepository
>() {}

export const startProspectingRun = (input: unknown) =>
  Effect.gen(function* () {
    const searchBrief = yield* decodeSearchBrief(input)
    const repository = yield* ProspectingRunRepositoryTag
    return yield* repository.createPending(searchBrief)
  })
