import { BLOCKED_INSPECTION_MAX_SEVERITY } from "@/features/website-assessment/client"

export const SCORE_RUBRIC_VERSION = "opportunity-score-v3" as const
export const REVIEW_QUEUE_THRESHOLD = 60

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
const SLOW_PAINT_MS = 1_500
const VERY_SLOW_PAINT_MS = 4_500

/** How defective a typical captured page is, so a site is not judged by how many pages were seen. */
export function observedDefectDensity(
  pages: readonly PageDefectMeasurements[],
  inspectionState?: ScoreInspectionState,
): number {
  // Having no website at all is the worst a website can be, and it is observed rather than assumed.
  if (inspectionState === "NoWebsite") return 1
  if (pages.length === 0) return 0
  const total = pages.reduce((sum, page) => sum + pageDefectDensity(page), 0)
  return bounded(total / pages.length)
}

function pageDefectDensity(page: PageDefectMeasurements): number {
  return bounded(
    bounded(page.unlabeledControls / CONTROL_CEILING) * 0.4 +
      bounded(page.imagesMissingAlt / MISSING_ALT_CEILING) * 0.25 +
      (page.horizontalOverflow ? 0.15 : 0) +
      (page.usesHttps ? 0 : 0.2) +
      bounded(
        (page.firstContentfulPaintMs - SLOW_PAINT_MS) / (VERY_SLOW_PAINT_MS - SLOW_PAINT_MS),
      ) *
        0.2,
  )
}

export function calculateOpportunityScore(input: ScoreInputs): ScoreBreakdown {
  const severityInput =
    input.inspectionState === "Blocked"
      ? Math.min(input.severity, BLOCKED_INSPECTION_MAX_SEVERITY)
      : input.severity
  const severity = bounded(severityInput / 5) * 40
  // A blocked inspection saw nothing, so it claims nothing here.
  const observedDefects = observedDefectDensity(input.observedPages, input.inspectionState) * 25
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
