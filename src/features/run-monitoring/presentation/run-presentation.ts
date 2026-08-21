import type { RunSummary } from "@/features/run-monitoring/domain/run-progress"

/** A run is "settled" once it can no longer make progress on its own. */
const settledStates = ["Completed", "Cancelled"]

/** Whether a run can still make progress, asked the same way by the table and the detail header. */
export function isRunSettled(state: string): boolean {
  return settledStates.includes(state)
}

export type RunStatusVariant =
  | "success"
  | "destructive"
  | "warning"
  | "info"
  | "secondary"
  | "outline"

export type RunStatusPresentation = Readonly<{
  /** Short enough to sit in a table cell without wrapping. */
  label: string
  variant: RunStatusVariant
  /** The full recorded wording, kept for the title so nothing is lost by shortening. */
  detail: string
}>

/**
 * Persisted run states read as sentences, which is too long for a badge. Each one is shortened to a
 * word or two and given the colour its outcome deserves, with the original kept as the detail.
 */
const statusPresentations: Readonly<Record<string, Omit<RunStatusPresentation, "detail">>> = {
  "Target Reached": { label: "Target Met", variant: "success" },
  "Search Exhausted": { label: "Exhausted", variant: "warning" },
  // A cancelled run stopped short of its target, so it reads as an outcome that went wrong.
  "Cancelled with Partial Results": { label: "Cancelled", variant: "destructive" },
  "Completed with Warnings": { label: "Warnings", variant: "warning" },
  "Runtime Unavailable": { label: "No Runtime", variant: "destructive" },
  "Infrastructure Failed": { label: "Failed", variant: "destructive" },
  Running: { label: "Running", variant: "info" },
  Completed: { label: "Completed", variant: "success" },
  Cancelled: { label: "Cancelled", variant: "destructive" },
  Paused: { label: "Paused", variant: "warning" },
}

export function runStatusPresentation(
  state: string,
  completionState?: string,
): RunStatusPresentation {
  const recorded = completionState ?? state
  const known = statusPresentations[recorded]
  return known
    ? { ...known, detail: recorded }
    : { label: humanizeStage(recorded), variant: "outline", detail: recorded }
}

export type RunRow = Readonly<{
  id: string
  category: string
  location: string
  status: RunStatusPresentation
  settled: boolean
  stage: string
  mode: string
  targetCount: number
  qualified: number
  discovered: number
  assessed: number
  /** Share of the requested target already qualified, 0–100. */
  completion: number
  /** ISO timestamp, kept for sorting. */
  updatedAt: string
  /** Formatted on the server so the client never re-derives a different relative time. */
  updatedLabel: string
}>

export function toRunRow(run: RunSummary, now: Date): RunRow {
  const target = run.searchBrief.targetCount
  return {
    id: run.id,
    category: run.searchBrief.category,
    location: run.searchBrief.searchArea.displayName,
    status: runStatusPresentation(run.state, run.completionState),
    settled: isRunSettled(run.state),
    stage: humanizeStage(run.currentStage),
    mode: run.searchBrief.mode,
    targetCount: target,
    qualified: run.progress.qualifiedCandidates,
    discovered: run.progress.discoveries,
    assessed: run.progress.assessments,
    completion:
      target <= 0
        ? 0
        : Math.min(100, Math.round((run.progress.qualifiedCandidates / target) * 100)),
    updatedAt: run.updatedAt,
    updatedLabel: formatUpdatedAt(run.updatedAt, now),
  }
}

/** Stage names are persisted as PascalCase identifiers; readers get spaced words. */
export function humanizeStage(stage: string | undefined): string {
  if (!stage) return "Waiting"
  return stage.replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
}

const relativeFormat = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" })
const absoluteFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" })

/** Short relative label such as "12 Minutes Ago", falling back to an absolute date past a week. */
export function formatUpdatedAt(isoDate: string, now: Date): string {
  const timestamp = Date.parse(isoDate)
  if (Number.isNaN(timestamp)) return "Unknown"
  const seconds = Math.round((timestamp - now.getTime()) / 1000)
  const magnitude = Math.abs(seconds)
  if (magnitude < 60) return "Just Now"
  if (magnitude < 3600) return titleCase(relativeFormat.format(Math.round(seconds / 60), "minute"))
  if (magnitude < 86_400)
    return titleCase(relativeFormat.format(Math.round(seconds / 3600), "hour"))
  if (magnitude < 604_800)
    return titleCase(relativeFormat.format(Math.round(seconds / 86_400), "day"))
  return absoluteFormat.format(new Date(timestamp))
}

/**
 * Intl returns lower-case prose such as "3 days ago", but labels in this interface are Title Cased.
 * Numbers and any other non-letter openings are left exactly as they are.
 */
function titleCase(value: string): string {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
