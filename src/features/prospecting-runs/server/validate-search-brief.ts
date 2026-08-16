import { Effect, Either } from "effect"

import { decodeSearchBriefDraft } from "@/features/prospecting-runs/domain/search-brief"

export const validateSearchBrief = (input: unknown) =>
  Effect.either(decodeSearchBriefDraft(input)).pipe(
    Effect.map(
      Either.match({
        onLeft: () => ({ valid: false as const }),
        onRight: (searchBrief) => ({ valid: true as const, searchBrief }),
      }),
    ),
  )
