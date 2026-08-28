import { Effect, JSONSchema, Schema } from "effect"

export const ASSESSMENT_SCHEMA_VERSION = "assessment-output-v1" as const
export const ASSESSMENT_PROMPT_VERSION = "website-assessment-v7" as const

export const WebsiteOpportunityClassSchema = Schema.Literal(
  "NoDedicatedWebsite",
  "BrokenOrUnusable",
  "OutdatedPresentation",
  "MobileAccessibilityOrPerformance",
  "WeakDiscoverability",
  "ConfusingConversionJourney",
)

export const ObservableEffectSchema = Schema.Literal(
  "Legibility",
  "Hierarchy",
  "Layout",
  "Trust",
  "ContentClarity",
  "ConversionFlow",
  "Performance",
  "Accessibility",
  "Discoverability",
)

export const EvidenceStateSchema = Schema.Literal(
  "ConfirmedFact",
  "AIAssessment",
  "MissingEvidence",
  "InspectionBlock",
)

export const SupportingObservationSchema = Schema.Struct({
  statement: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(1_000)),
  sourceUrl: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(2_000)),
  observedAt: Schema.String.pipe(
    Schema.pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u),
  ),
  evidenceState: EvidenceStateSchema,
  confidence: Schema.Number.pipe(Schema.between(0, 1)),
})

export const WebsiteOpportunitySchema = Schema.Struct({
  class: WebsiteOpportunityClassSchema,
  severity: Schema.Number.pipe(Schema.int(), Schema.between(1, 5)),
  confidence: Schema.Number.pipe(Schema.between(0, 1)),
  observableEffect: ObservableEffectSchema,
  explanation: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(1_000)),
  observations: Schema.Array(SupportingObservationSchema).pipe(
    Schema.minItems(1),
    Schema.maxItems(5),
  ),
})

export const AssessmentOutputSchema = Schema.Struct({
  schemaVersion: Schema.Literal(ASSESSMENT_SCHEMA_VERSION),
  assessmentState: Schema.Literal("Completed", "InsufficientEvidence"),
  summary: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(2_000)),
  apparentCommercialValue: Schema.Number.pipe(Schema.between(0, 1)),
  opportunities: Schema.Array(WebsiteOpportunitySchema).pipe(Schema.maxItems(6)),
})

export type AssessmentOutput = typeof AssessmentOutputSchema.Type
export type AllowedAssessmentCitations = ReadonlyMap<string, ReadonlySet<string>>

export const assessmentOutputJsonSchema = JSONSchema.make(AssessmentOutputSchema, {
  target: "jsonSchema7",
})

export class AssessmentValidationError extends Error {
  readonly code:
    | "malformed-output"
    | "out-of-stage-output"
    | "missing-citation"
    | "unsupported-claim"

  constructor(code: AssessmentValidationError["code"], message: string) {
    super(message)
    this.name = "AssessmentValidationError"
    this.code = code
  }
}

export function decodeAssessmentOutput(
  value: unknown,
  allowedCitations: AllowedAssessmentCitations,
) {
  return Schema.decodeUnknown(AssessmentOutputSchema, { onExcessProperty: "error" })(value).pipe(
    Effect.mapError(
      () =>
        new AssessmentValidationError(
          hasOutOfStageKeys(value) ? "out-of-stage-output" : "malformed-output",
          "The runtime output does not match the assessment-only schema.",
        ),
    ),
    Effect.flatMap((output) => validateCitations(output, allowedCitations)),
  )
}

function validateCitations(output: AssessmentOutput, allowedCitations: AllowedAssessmentCitations) {
  for (const opportunity of output.opportunities) {
    if (opportunity.observations.length === 0) {
      return Effect.fail(
        new AssessmentValidationError(
          "missing-citation",
          "Every Website Opportunity requires a Supporting Observation.",
        ),
      )
    }
    for (const observation of opportunity.observations) {
      const allowedTimes = allowedCitations.get(normalizeUrl(observation.sourceUrl))
      if (!allowedTimes?.has(observation.observedAt)) {
        return Effect.fail(
          new AssessmentValidationError(
            "unsupported-claim",
            "A Supporting Observation cited a URL and time outside the supplied evidence envelope.",
          ),
        )
      }
    }
  }
  if (output.assessmentState === "InsufficientEvidence" && output.opportunities.length > 0) {
    return Effect.fail(
      new AssessmentValidationError(
        "unsupported-claim",
        "Insufficient evidence cannot produce a Website Opportunity.",
      ),
    )
  }
  return Effect.succeed(output)
}

function hasOutOfStageKeys(value: unknown): boolean {
  if (!isRecord(value)) return false
  const allowedRoot = new Set([
    "schemaVersion",
    "assessmentState",
    "summary",
    "apparentCommercialValue",
    "opportunities",
  ])
  if (Object.keys(value).some((key) => !allowedRoot.has(key))) return true
  if (!Array.isArray(value.opportunities)) return false
  const allowedOpportunity = new Set([
    "class",
    "severity",
    "confidence",
    "observableEffect",
    "explanation",
    "observations",
  ])
  const allowedObservation = new Set([
    "statement",
    "sourceUrl",
    "observedAt",
    "evidenceState",
    "confidence",
  ])
  return value.opportunities.some(
    (opportunity) =>
      isRecord(opportunity) &&
      (Object.keys(opportunity).some((key) => !allowedOpportunity.has(key)) ||
        (Array.isArray(opportunity.observations) &&
          opportunity.observations.some(
            (observation) =>
              isRecord(observation) &&
              Object.keys(observation).some((key) => !allowedObservation.has(key)),
          ))),
  )
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value)
    url.hash = ""
    return url.toString()
  } catch {
    return value
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
