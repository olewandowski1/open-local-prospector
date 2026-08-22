// A tile carries a direction only when two comparable periods exist, so an arrow is always a measured change.
export type OverviewTrend = "up" | "down" | "flat" | "none"

export type OverviewMetric = Readonly<{
  id: string
  label: string
  value: string
  trend: OverviewTrend
  note: string
}>

export type OverviewRunSnapshot = Readonly<{
  state: string
  createdAt: string
  progress: Readonly<{ discoveries: number; qualifiedCandidates: number }>
}>

export type OverviewCandidateSummary = Readonly<{
  qualified: number
  unreviewed: number
  shortlisted: number
  topScore: number
  qualifiedThisWeek: number
  qualifiedLastWeek: number
}>

const terminalRunStates = ["Completed", "Cancelled"]
const WEEK_IN_MILLISECONDS = 7 * 24 * 60 * 60 * 1000

export function isRunActive(run: OverviewRunSnapshot): boolean {
  return !terminalRunStates.includes(run.state)
}

export function calculateOverviewMetrics(
  runs: readonly OverviewRunSnapshot[],
  candidates: OverviewCandidateSummary,
  now: Date,
): readonly OverviewMetric[] {
  const discovered = runs.reduce((total, run) => total + run.progress.discoveries, 0)
  const activeRuns = runs.filter(isRunActive).length
  const discoveredThisWeek = discoveriesWithin(runs, now, 0)
  const discoveredLastWeek = discoveriesWithin(runs, now, 1)

  return [
    {
      id: "discovered",
      label: "Businesses Discovered",
      value: String(discovered),
      ...change(discoveredThisWeek, discoveredLastWeek, runs.length === 0 ? "No Runs Yet" : ""),
    },
    {
      id: "qualified",
      label: "Qualified Candidates",
      value: String(candidates.qualified),
      ...change(
        candidates.qualifiedThisWeek,
        candidates.qualifiedLastWeek,
        discovered === 0 ? "Nothing Discovered Yet" : "",
      ),
    },
    {
      id: "awaiting-review",
      label: "Awaiting Review",
      value: String(candidates.unreviewed),
      trend: "none",
      note:
        candidates.qualified === 0
          ? "Nothing To Review Yet"
          : countLabel(candidates.shortlisted, "Shortlisted", "Shortlisted"),
    },
    {
      id: "active-runs",
      label: "Active Runs",
      value: String(activeRuns),
      trend: "none",
      note:
        candidates.qualified === 0
          ? "No Scored Candidates Yet"
          : `Top Score ${formatScore(candidates.topScore)}`,
    },
  ]
}

function change(
  thisWeek: number,
  lastWeek: number,
  emptyNote: string,
): Pick<OverviewMetric, "trend" | "note"> {
  if (emptyNote) return { trend: "none", note: emptyNote }
  const difference = thisWeek - lastWeek
  if (difference > 0) return { trend: "up", note: `+${difference} This Week` }
  if (difference < 0) return { trend: "down", note: `${difference} This Week` }
  return { trend: "flat", note: "No Change This Week" }
}

function discoveriesWithin(
  runs: readonly OverviewRunSnapshot[],
  now: Date,
  weeksAgo: number,
): number {
  const end = now.getTime() - weeksAgo * WEEK_IN_MILLISECONDS
  const start = end - WEEK_IN_MILLISECONDS
  return runs.reduce((total, run) => {
    const createdAt = Date.parse(run.createdAt)
    if (Number.isNaN(createdAt) || createdAt <= start || createdAt > end) return total
    return total + run.progress.discoveries
  }, 0)
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}
