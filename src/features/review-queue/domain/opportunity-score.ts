import {
  BLOCKED_INSPECTION_MAX_CONFIDENCE,
  BLOCKED_INSPECTION_MAX_SEVERITY,
} from "@/features/website-assessment/client"

export const SCORE_RUBRIC_VERSION = "opportunity-score-v2" as const
export const REVIEW_QUEUE_THRESHOLD = 60

export type ScoreInspectionState = "Complete" | "Partial" | "Blocked" | "NoWebsite"

export type ScoreInputs = Readonly<{
  severity: number
  observationConfidence: number
  hasContactRoute: boolean
  localDecisionLikelihood: number
  apparentCommercialValue: number
  inspectionState: ScoreInspectionState
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

export type QualificationEvidence = Readonly<{
  hasOpportunity: boolean
  hasObservation: boolean
  hasContactRoute: boolean
  suppressed: boolean
}>

export function calculateOpportunityScore(input: ScoreInputs): ScoreBreakdown {
  const severityInput =
    input.inspectionState === "Blocked"
      ? Math.min(input.severity, BLOCKED_INSPECTION_MAX_SEVERITY)
      : input.severity
  const confidenceInput =
    input.inspectionState === "Blocked"
      ? Math.min(input.observationConfidence, BLOCKED_INSPECTION_MAX_CONFIDENCE)
      : input.observationConfidence
  const severity = bounded(severityInput / 5) * 40
  const observationConfidence = bounded(confidenceInput) * 25
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

export function qualifiesOpportunityScore(
  score: ScoreBreakdown,
  evidence: QualificationEvidence,
): boolean {
  return (
    score.total >= REVIEW_QUEUE_THRESHOLD &&
    evidence.hasOpportunity &&
    evidence.hasObservation &&
    evidence.hasContactRoute &&
    !evidence.suppressed
  )
}

function bounded(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}
