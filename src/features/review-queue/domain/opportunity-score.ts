export const SCORE_RUBRIC_VERSION = "opportunity-score-v1" as const
export const REVIEW_QUEUE_THRESHOLD = 60

export type ScoreInputs = Readonly<{
  severity: number
  observationConfidence: number
  hasContactRoute: boolean
  localDecisionLikelihood: number
  apparentCommercialValue: number
}>
export type ScoreBreakdown = Readonly<{
  severity: number
  observationConfidence: number
  contactRoute: number
  localDecisionLikelihood: number
  apparentCommercialValue: number
  total: number
  rubricVersion: typeof SCORE_RUBRIC_VERSION
}>

export function calculateOpportunityScore(input: ScoreInputs): ScoreBreakdown {
  const severity = bounded(input.severity / 5) * 40
  const observationConfidence = bounded(input.observationConfidence) * 25
  const contactRoute = input.hasContactRoute ? 15 : 0
  const localDecisionLikelihood = bounded(input.localDecisionLikelihood) * 10
  const apparentCommercialValue = bounded(input.apparentCommercialValue) * 10
  return {
    severity,
    observationConfidence,
    contactRoute,
    localDecisionLikelihood,
    apparentCommercialValue,
    total:
      Math.round(
        (severity +
          observationConfidence +
          contactRoute +
          localDecisionLikelihood +
          apparentCommercialValue) *
          100,
      ) / 100,
    rubricVersion: SCORE_RUBRIC_VERSION,
  }
}

function bounded(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}
