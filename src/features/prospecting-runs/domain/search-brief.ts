import { Schema } from "effect"

const TrimmedNonEmptyString = Schema.Trim.pipe(Schema.minLength(1))

export const RuntimeIdSchema = Schema.Literal("codex", "claude", "opencode")

export type RuntimeId = typeof RuntimeIdSchema.Type

export const SearchBriefSchema = Schema.Struct({
  location: TrimmedNonEmptyString,
  radiusKm: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
  category: TrimmedNonEmptyString,
  targetCount: Schema.Number.pipe(Schema.int(), Schema.between(5, 50)),
  mode: Schema.Literal("Quick", "Thorough"),
  runtime: RuntimeIdSchema,
})

export type SearchBrief = typeof SearchBriefSchema.Type

export const decodeSearchBrief = Schema.decodeUnknown(SearchBriefSchema)
