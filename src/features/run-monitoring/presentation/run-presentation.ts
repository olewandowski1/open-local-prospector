import type { RunSummary } from "@/features/run-monitoring/domain/run-progress"

/** A run is "settled" once it can no longer make progress on its own. */
const settledStates = ["Completed", "Cancelled"]

export type RunRow = Readonly<{
  id: string
  category: string
  location: string
  status: string
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
    status: run.completionState ?? run.state,
    settled: settledStates.includes(run.state),
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

/** Short relative label such as "12 minutes ago", falling back to an absolute date past a week. */
export function formatUpdatedAt(isoDate: string, now: Date): string {
  const timestamp = Date.parse(isoDate)
  if (Number.isNaN(timestamp)) return "Unknown"
  const seconds = Math.round((timestamp - now.getTime()) / 1000)
  const magnitude = Math.abs(seconds)
  if (magnitude < 60) return "Just now"
  if (magnitude < 3600) return relativeFormat.format(Math.round(seconds / 60), "minute")
  if (magnitude < 86_400) return relativeFormat.format(Math.round(seconds / 3600), "hour")
  if (magnitude < 604_800) return relativeFormat.format(Math.round(seconds / 86_400), "day")
  return absoluteFormat.format(new Date(timestamp))
}
