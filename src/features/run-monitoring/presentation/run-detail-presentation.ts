import type {
  RunDetail,
  RunProgressCounts,
  TechnicalRunEvent,
} from "@/features/run-monitoring/domain/run-progress"

export type RunCountItem = Readonly<{
  key: keyof RunProgressCounts
  label: string
  value: number
}>

export function runFunnel(progress: RunProgressCounts): readonly RunCountItem[] {
  return [
    { key: "queries", label: "Queries", value: progress.queries },
    { key: "discoveries", label: "Discoveries", value: progress.discoveries },
    { key: "websites", label: "Websites", value: progress.websites },
    { key: "assessments", label: "Assessments", value: progress.assessments },
    { key: "qualifiedCandidates", label: "Qualified", value: progress.qualifiedCandidates },
  ]
}

export function runAdjustments(progress: RunProgressCounts): readonly RunCountItem[] {
  return [
    { key: "duplicates", label: "Duplicates", value: progress.duplicates },
    { key: "exclusions", label: "Exclusions", value: progress.exclusions },
    { key: "blockedInspections", label: "Blocked Inspections", value: progress.blockedInspections },
    { key: "targetRemaining", label: "Target Remaining", value: progress.targetRemaining },
  ]
}

export type RunControlAvailability = Readonly<{
  canPause: boolean
  canResume: boolean
  canCancel: boolean
}>

const terminalStates = ["Completed", "Cancelled"]

export function runControlAvailability(run: RunDetail): RunControlAvailability {
  return {
    canPause: ["Pending", "Running"].includes(run.state) && run.requestedControl === "None",
    canResume: run.state === "Paused" || run.completionState === "Runtime Unavailable",
    canCancel: !terminalStates.includes(run.state),
  }
}

export function isRunTerminal(run?: RunDetail): boolean {
  return run ? terminalStates.includes(run.state) : false
}

export type EventKindCount = Readonly<{ kind: string; count: number }>

export function eventKindCounts(events: readonly TechnicalRunEvent[]): readonly EventKindCount[] {
  const counts = new Map<string, number>()
  for (const event of events) {
    counts.set(event.kind, (counts.get(event.kind) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((left, right) => right.count - left.count || left.kind.localeCompare(right.kind))
}

export type TechnicalLogFilter = Readonly<{ kind?: string; businessId?: string }>

export function filterTechnicalLog(
  events: readonly TechnicalRunEvent[],
  filter: TechnicalLogFilter,
): readonly TechnicalRunEvent[] {
  return events.filter(
    (event) =>
      (!filter.kind || event.kind === filter.kind) &&
      (!filter.businessId || event.businessId === filter.businessId),
  )
}

// Only http(s) URLs are ever turned into links; Source Content is untrusted.
export function safeHttpUrl(value?: string): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined
  } catch {
    return undefined
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

export function eventSourceLabel(sourceIdentifier: string): string {
  return uuidPattern.test(sourceIdentifier) ? `#${sourceIdentifier.slice(0, 8)}` : sourceIdentifier
}

export function businessStatusTone(
  status: string,
): "muted" | "destructive" | "warning" | "success" {
  if (["FailedPermanent", "Failed"].includes(status)) return "destructive"
  if (["Blocked", "Unreachable", "Retrying"].includes(status)) return "warning"
  if (["Qualified", "Completed", "Scored"].includes(status)) return "success"
  return "muted"
}

export function formatBusinessScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}
