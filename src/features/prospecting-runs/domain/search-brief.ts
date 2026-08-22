import { Schema } from "effect"

const TrimmedNonEmptyString = Schema.Trim.pipe(Schema.minLength(1))

export const RuntimeIdSchema = Schema.Literal("codex", "claude", "opencode")

export type RuntimeId = typeof RuntimeIdSchema.Type

export const SearchBriefDraftSchema = Schema.Struct({
  location: TrimmedNonEmptyString,
  radiusKm: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
  category: TrimmedNonEmptyString,
  targetCount: Schema.Number.pipe(Schema.int(), Schema.between(5, 50)),
  mode: Schema.Literal("Quick", "Thorough"),
  runtime: RuntimeIdSchema,
  runtimeConfiguration: Schema.optional(
    Schema.Struct({
      model: TrimmedNonEmptyString,
      reasoningEffort: Schema.Literal(
        "none",
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max",
        "ultra",
      ),
    }),
  ),
  recentBusinessPolicy: Schema.optional(
    Schema.Literal("Skip", "IncludeWithoutReassessment", "Reassess"),
  ),
})

export type SearchBriefDraft = typeof SearchBriefDraftSchema.Type

export const SearchAreaSchema = Schema.Struct({
  id: TrimmedNonEmptyString,
  displayName: TrimmedNonEmptyString,
  latitude: Schema.Number.pipe(Schema.between(-90, 90)),
  longitude: Schema.Number.pipe(Schema.between(-180, 180)),
  countryCode: Schema.String.pipe(Schema.uppercased(), Schema.length(2)),
})

export type SearchArea = typeof SearchAreaSchema.Type

export const SearchBriefSchema = Schema.extend(
  SearchBriefDraftSchema,
  Schema.Struct({ searchArea: SearchAreaSchema }),
)

export type SearchBrief = typeof SearchBriefSchema.Type

export const decodeSearchBriefDraft = Schema.decodeUnknown(SearchBriefDraftSchema)
export const decodeSearchBrief = Schema.decodeUnknown(SearchBriefSchema)
