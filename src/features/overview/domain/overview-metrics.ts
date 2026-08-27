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
  discoveries: number
  activeRuns: number
  discoveriesThisWeek: number
  discoveriesLastWeek: number
  hasRuns: boolean
}>

export type OverviewCandidateSummary = Readonly<{
  qualified: number
  unreviewed: number
  shortlisted: number
  topScore: number
  qualifiedThisWeek: number
  qualifiedLastWeek: number
}>

export function calculateOverviewMetrics(
  runs: OverviewRunSnapshot,
  candidates: OverviewCandidateSummary,
): readonly OverviewMetric[] {
  return [
    {
      id: "discovered",
      label: "Businesses Discovered",
      value: String(runs.discoveries),
      ...change(
        runs.discoveriesThisWeek,
        runs.discoveriesLastWeek,
        runs.hasRuns ? "" : "No Runs Yet",
      ),
    },
    {
      id: "qualified",
      label: "Qualified Candidates",
      value: String(candidates.qualified),
      ...change(
        candidates.qualifiedThisWeek,
        candidates.qualifiedLastWeek,
        runs.discoveries === 0 ? "Nothing Discovered Yet" : "",
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
      value: String(runs.activeRuns),
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

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}
