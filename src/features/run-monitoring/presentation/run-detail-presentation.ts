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

/**
 * The pipeline a Prospecting Run moves work through, in order. Presenting these as a funnel shows
 * where work was lost between stages, which nine equal tiles cannot.
 */
export function runFunnel(progress: RunProgressCounts): readonly RunCountItem[] {
  return [
    { key: "queries", label: "Queries", value: progress.queries },
    { key: "discoveries", label: "Discoveries", value: progress.discoveries },
    { key: "websites", label: "Websites", value: progress.websites },
    { key: "assessments", label: "Assessments", value: progress.assessments },
    { key: "qualifiedCandidates", label: "Qualified", value: progress.qualifiedCandidates },
  ]
}

/** Counts that explain why the funnel narrowed, kept apart from the pipeline itself. */
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

/** Event kinds present in the log, most frequent first, for filtering the log down. */
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

/** Only http(s) URLs are ever turned into links; Source Content is untrusted. */
export function safeHttpUrl(value?: string): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined
  } catch {
    return undefined
  }
}
