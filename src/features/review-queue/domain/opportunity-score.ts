import { BLOCKED_INSPECTION_MAX_SEVERITY } from "@/features/website-assessment/client"

export const SCORE_RUBRIC_VERSION = "opportunity-score-v5" as const
// Severity 3 alone scores 64.5 before any defect is counted, so 60 qualified every site that exists.
export const REVIEW_QUEUE_THRESHOLD = 72

export type ScoreInspectionState = "Complete" | "Partial" | "Blocked" | "NoWebsite"

/** The deterministic per-page numbers the inspection recorded, which the rubric reads directly. */
export type PageDefectMeasurements = Readonly<{
  unlabeledControls: number
  imagesMissingAlt: number
  horizontalOverflow: boolean
  usesHttps: boolean
  firstContentfulPaintMs: number
}>

export type ScoreInputs = Readonly<{
  severity: number
  observedPages: readonly PageDefectMeasurements[]
  hasContactRoute: boolean
  localDecisionLikelihood: number
  apparentCommercialValue: number
  inspectionState: ScoreInspectionState
}>
export type ScoreBreakdown = Readonly<{
  severity: number
  observedDefects: number
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

// Counts above the ceiling stop adding, so one very poor page cannot swamp the rest of the score.
const CONTROL_CEILING = 8
const MISSING_ALT_CEILING = 8

/** The worst captured page, because averaging hid a slow home page behind three fast ones. */
export function observedDefectDensity(
  pages: readonly PageDefectMeasurements[],
  inspectionState?: ScoreInspectionState,
): number {
  // Having no website at all is the worst a website can be, and it is observed rather than assumed.
  if (inspectionState === "NoWebsite") return 1
  if (pages.length === 0) return 0
  return bounded(Math.max(...pages.map(pageDefectDensity)))
}

// Paint time is deliberately absent: one home page measured 296 ms and 3,448 ms across runs, so scoring it moved the total on network luck.
function pageDefectDensity(page: PageDefectMeasurements): number {
  return bounded(
    bounded(page.unlabeledControls / CONTROL_CEILING) * 0.4 +
      bounded(page.imagesMissingAlt / MISSING_ALT_CEILING) * 0.25 +
      (page.horizontalOverflow ? 0.15 : 0) +
      (page.usesHttps ? 0 : 0.2),
  )
}

export function calculateOpportunityScore(input: ScoreInputs): ScoreBreakdown {
  const severityInput =
    input.inspectionState === "Blocked"
      ? Math.min(input.severity, BLOCKED_INSPECTION_MAX_SEVERITY)
      : input.severity
  const severity = bounded(severityInput / 5) * 55
  // Measurements break ties between sites the runtime rated alike, but cannot carry the score: a site can measure clean and still be why a business needs a new website.
  const observedDefects = observedDefectDensity(input.observedPages, input.inspectionState) * 10
  const contactRoute = input.hasContactRoute ? 15 : 0
  const localDecisionLikelihood = bounded(input.localDecisionLikelihood) * 10
  const apparentCommercialValue = bounded(input.apparentCommercialValue) * 10
  return {
    severity,
    observedDefects,
    contactRoute,
    localDecisionLikelihood,
    apparentCommercialValue,
    total:
      Math.round(
        (severity +
          observedDefects +
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
