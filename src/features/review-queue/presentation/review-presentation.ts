import type { QueueCandidate } from "@/features/review-queue/server/review-queue-read-model"

/** Persisted vocabularies are PascalCase identifiers; readers get spaced words. */
export function humanizeTerm(value: string): string {
  return (
    value
      // A run of capitals ends where the next word begins, so "NotALocalDecision" does not become
      // "Not ALocal Decision".
      .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2")
      .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
  )
}

/**
 * Scores are stored as floats. Reviewers compare candidates, so one decimal is the most precision
 * that carries meaning — `24.666666666666668` reads as noise, not as evidence.
 */
export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export type ScoreComponent = Readonly<{
  label: string
  value: number
  /** Highest score this component can contribute, from the deterministic rubric. */
  max: number
}>

/** Component maxima come from the v1 opportunity-score rubric weights. */
export function scoreComponents(candidate: QueueCandidate): readonly ScoreComponent[] {
  return [
    { label: "Severity", value: candidate.breakdown.severity, max: 40 },
    { label: "Confidence", value: candidate.breakdown.confidence, max: 25 },
    { label: "Contact Route", value: candidate.breakdown.contact, max: 15 },
    { label: "Local Decision", value: candidate.breakdown.localDecision, max: 10 },
    { label: "Commercial Value", value: candidate.breakdown.commercialValue, max: 10 },
  ]
}

const observedFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" })

/** ISO timestamps are storage detail; reviewers only need the day evidence was observed. */
export function formatObservedAt(isoDate: string): string {
  const timestamp = Date.parse(isoDate)
  return Number.isNaN(timestamp) ? "Unknown Date" : observedFormat.format(new Date(timestamp))
}

/** A readable stand-in for a long URL. Falls back to the raw value when it will not parse. */
export function displayUrl(value: string): string {
  try {
    const url = new URL(value)
    const path = url.pathname === "/" ? "" : url.pathname
    return `${url.hostname.replace(/^www\./u, "")}${path}`
  } catch {
    return value
  }
}

export type PresenceGroup = Readonly<{ type: string; urls: readonly string[] }>

/** Groups presences by type so ten "Website:" lines become one labelled block. */
export function groupPresences(presences: QueueCandidate["presences"]): readonly PresenceGroup[] {
  const groups = new Map<string, string[]>()
  for (const presence of presences) {
    const urls = groups.get(presence.type) ?? []
    if (!urls.includes(presence.url)) urls.push(presence.url)
    groups.set(presence.type, urls)
  }
  return [...groups.entries()].map(([type, urls]) => ({ type, urls }))
}

export type ReviewStatusVariant =
  | "success"
  | "destructive"
  | "warning"
  | "info"
  | "secondary"
  | "outline"

/**
 * Each review decision reads as its own outcome: a shortlisted candidate is progress, a rejected one
 * is closed, and an archived one is out of the way. Unreviewed stays neutral because it is the state
 * every candidate starts in, not a result.
 */
const statusVariants: Readonly<Record<string, ReviewStatusVariant>> = {
  Unreviewed: "outline",
  Shortlisted: "success",
  Rejected: "destructive",
  Contacted: "info",
  Archived: "secondary",
}

export function reviewStatusVariant(status: string): ReviewStatusVariant {
  return statusVariants[status] ?? "outline"
}
