import type { QueueCandidate } from "@/features/review-queue/server/review-queue-read-model"

/** Persisted terms arrive as `NoDedicatedWebsite` or as `navigation-failed`; both are read aloud. */
export function humanizeTerm(value: string): string {
  return (
    value
      // A run of capitals ends where the next word begins, so "NotALocalDecision" keeps its "A".
      .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2")
      .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
      .replace(/[-_]+/gu, " ")
      .replace(/(^|\s)(\p{Ll})/gu, (_, lead, letter) => lead + letter.toLocaleUpperCase())
  )
}

// Keep one decimal so every Opportunity Score reads on the same scale.
export function formatScore(value: number): string {
  return value.toFixed(1)
}

export type ScoreComponent = Readonly<{
  label: string
  value: number
  max: number
}>

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

export function formatObservedAt(isoDate: string): string {
  const timestamp = Date.parse(isoDate)
  return Number.isNaN(timestamp) ? "Unknown Date" : observedFormat.format(new Date(timestamp))
}

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

export function groupPresences(presences: QueueCandidate["presences"]): readonly PresenceGroup[] {
  const groups = new Map<string, string[]>()
  for (const presence of presences) {
    const urls = groups.get(presence.type) ?? []
    if (!urls.includes(presence.url)) urls.push(presence.url)
    groups.set(presence.type, urls)
  }
  return [...groups.entries()].map(([type, urls]) => ({ type, urls }))
}

export type MeasurementFact = Readonly<{ label: string; value: string }>

const countFormat = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 })

export function measurementFacts(
  measurement: QueueCandidate["measurements"][number]["values"],
): readonly MeasurementFact[] {
  return [
    ...(measurement.navigationDurationMs === undefined
      ? []
      : [{ label: "Page Load", value: formatMilliseconds(measurement.navigationDurationMs) }]),
    ...(measurement.firstContentfulPaintMs === undefined
      ? []
      : [
          {
            label: "First Contentful Paint",
            value: formatMilliseconds(measurement.firstContentfulPaintMs),
          },
        ]),
    { label: "DOM Nodes", value: countFormat.format(measurement.domNodes) },
    { label: "Images", value: countFormat.format(measurement.images) },
    { label: "Images Missing Alt Text", value: countFormat.format(measurement.imagesMissingAlt) },
    { label: "Unlabelled Controls", value: countFormat.format(measurement.unlabeledControls) },
    {
      label: "Horizontal Overflow",
      value: measurement.horizontalOverflow ? "Detected" : "Not Detected",
    },
    { label: "HTTPS", value: measurement.usesHttps ? "Yes" : "No" },
  ]
}

function formatMilliseconds(value: number): string {
  return `${(value / 1_000).toFixed(2)} s`
}

export type ReviewStatusVariant =
  | "success"
  | "destructive"
  | "warning"
  | "info"
  | "secondary"
  | "outline"

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

export type QueueFilter = Readonly<{ status: string; locality: string; opportunity: string }>

export const ALL = "All" as const

export const emptyQueueFilter: QueueFilter = { status: ALL, locality: ALL, opportunity: ALL }

export function isQueueFiltered(filter: QueueFilter): boolean {
  return filter.status !== ALL || filter.locality !== ALL || filter.opportunity !== ALL
}

// Offer only filter values present in the queue.
export function queueFilterOptions(
  candidates: readonly Readonly<{ locality: string; primaryOpportunity: string }>[],
): Readonly<{ localities: readonly string[]; opportunities: readonly string[] }> {
  const localities = new Set<string>()
  const opportunities = new Set<string>()
  for (const candidate of candidates) {
    if (candidate.locality) localities.add(candidate.locality)
    if (candidate.primaryOpportunity) opportunities.add(candidate.primaryOpportunity)
  }
  return {
    localities: [...localities].toSorted((left, right) => left.localeCompare(right)),
    opportunities: [...opportunities].toSorted((left, right) => left.localeCompare(right)),
  }
}

export function filterQueueCandidates<
  T extends Readonly<{ reviewStatus: string; locality: string; primaryOpportunity: string }>,
>(candidates: readonly T[], filter: QueueFilter): readonly T[] {
  return candidates.filter(
    (candidate) =>
      (filter.status === ALL || candidate.reviewStatus === filter.status) &&
      (filter.locality === ALL || candidate.locality === filter.locality) &&
      (filter.opportunity === ALL || candidate.primaryOpportunity === filter.opportunity),
  )
}
