import type { RunSummary } from "@/features/run-monitoring/domain/run-progress"

const settledStates = ["Completed", "Cancelled"]

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
  label: string
  variant: RunStatusVariant
  detail: string
}>

// Persisted states read as sentences, too long for a badge, so the original is kept as the detail.
const statusPresentations: Readonly<Record<string, Omit<RunStatusPresentation, "detail">>> = {
  "Reassessment Complete": { label: "Reassessed", variant: "success" },
  "Target Reached": { label: "Target Met", variant: "success" },
  "Search Exhausted": { label: "Exhausted", variant: "warning" },
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
  completion: number
  updatedAt: string
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

export function humanizeStage(stage: string | undefined): string {
  if (!stage) return "Waiting"
  return stage.replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
}

const relativeFormat = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" })
const absoluteFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" })

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

function titleCase(value: string): string {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

// Present work completed in flight beyond the target as an explicit surplus.
export function formatQualified(qualified: number, target: number, separator = "/"): string {
  const counted = Math.min(qualified, target)
  const surplus = Math.max(0, qualified - target)
  const met = `${counted}${separator}${target}`
  return surplus > 0 ? `${met} (+${surplus} More)` : met
}
