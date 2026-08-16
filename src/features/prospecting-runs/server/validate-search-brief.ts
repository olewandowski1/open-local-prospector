import { Effect, Either } from "effect"

import { decodeSearchBrief } from "@/features/prospecting-runs/domain/search-brief"

export const validateSearchBrief = (input: unknown) =>
  Effect.either(decodeSearchBrief(input)).pipe(
    Effect.map(
      Either.match({
        onLeft: () => ({ valid: false as const }),
        onRight: (searchBrief) => ({ valid: true as const, searchBrief }),
      }),
    ),
  )
