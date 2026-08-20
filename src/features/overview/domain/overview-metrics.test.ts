import { describe, expect, it } from "vitest"
import {
  calculateOverviewMetrics,
  isRunActive,
  type OverviewCandidateSummary,
  type OverviewMetric,
  type OverviewRunSnapshot,
} from "@/features/overview/domain/overview-metrics"

const NOW = new Date("2026-08-16T12:00:00.000Z")
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

const run = (
  state: string,
  discoveries: number,
  createdAt: string = daysAgo(1),
): OverviewRunSnapshot => ({
  state,
  createdAt,
  progress: { discoveries, qualifiedCandidates: 0 },
})

const summary = (values: Partial<OverviewCandidateSummary>): OverviewCandidateSummary => ({
  qualified: 0,
  unreviewed: 0,
  shortlisted: 0,
  topScore: 0,
  qualifiedThisWeek: 0,
  qualifiedLastWeek: 0,
  ...values,
})

const metric = (metrics: readonly OverviewMetric[], id: string) => {
  const found = metrics.find((item) => item.id === id)
  if (!found) throw new Error(`missing metric ${id}`)
  return found
}

describe("overview metrics", () => {
  it("totals discoveries and active runs from persisted run progress", () => {
    const metrics = calculateOverviewMetrics(
      [run("Completed", 38), run("Running", 24), run("Cancelled", 4)],
      summary({ qualified: 19, unreviewed: 6, shortlisted: 4, topScore: 91 }),
      NOW,
    )

    expect(metric(metrics, "discovered")).toMatchObject({ value: "66" })
    expect(metric(metrics, "active-runs")).toMatchObject({
      value: "1",
      note: "Top Score 91",
      trend: "none",
    })
  })

  it("compares this week against the week before it", () => {
    const metrics = calculateOverviewMetrics(
      [run("Completed", 10, daysAgo(2)), run("Completed", 4, daysAgo(9))],
      summary({ qualified: 5, qualifiedThisWeek: 4, qualifiedLastWeek: 1 }),
      NOW,
    )

    expect(metric(metrics, "discovered")).toMatchObject({ trend: "up", note: "+6 This Week" })
    expect(metric(metrics, "qualified")).toMatchObject({ trend: "up", note: "+3 This Week" })
  })

  it("points the arrow down when a week is quieter than the last", () => {
    const metrics = calculateOverviewMetrics(
      [run("Completed", 2, daysAgo(1)), run("Completed", 9, daysAgo(10))],
      summary({ qualified: 3, qualifiedThisWeek: 0, qualifiedLastWeek: 3 }),
      NOW,
    )

    expect(metric(metrics, "discovered")).toMatchObject({ trend: "down", note: "-7 This Week" })
    expect(metric(metrics, "qualified")).toMatchObject({ trend: "down", note: "-3 This Week" })
  })

  it("reports a flat week rather than an arrow when nothing moved", () => {
    const metrics = calculateOverviewMetrics(
      [run("Completed", 5, daysAgo(1)), run("Completed", 5, daysAgo(9))],
      summary({ qualified: 2, qualifiedThisWeek: 1, qualifiedLastWeek: 1 }),
      NOW,
    )

    expect(metric(metrics, "discovered")).toMatchObject({
      trend: "flat",
      note: "No Change This Week",
    })
  })

  it("ignores runs older than the two comparison windows", () => {
    const metrics = calculateOverviewMetrics(
      [run("Completed", 40, daysAgo(60)), run("Completed", 3, daysAgo(1))],
      summary({ qualified: 1 }),
      NOW,
    )

    expect(metric(metrics, "discovered")).toMatchObject({ value: "43", note: "+3 This Week" })
  })

  it("expresses qualification as a share of discovered businesses", () => {
    const metrics = calculateOverviewMetrics(
      [run("Completed", 40)],
      summary({ qualified: 10, unreviewed: 3, shortlisted: 1 }),
      NOW,
    )

    expect(metric(metrics, "awaiting-review")).toMatchObject({
      value: "3",
      note: "1 Shortlisted",
      trend: "none",
    })
  })

  it("shows no arrow and no invented comparison before any run exists", () => {
    const metrics = calculateOverviewMetrics([], summary({}), NOW)

    expect(metrics.map((item) => item.value)).toEqual(["0", "0", "0", "0"])
    expect(metrics.every((item) => item.trend === "none")).toBe(true)
    expect(metric(metrics, "discovered").note).toBe("No Runs Yet")
    expect(metric(metrics, "qualified").note).toBe("Nothing Discovered Yet")
    expect(metric(metrics, "awaiting-review").note).toBe("Nothing To Review Yet")
    expect(metric(metrics, "active-runs").note).toBe("No Scored Candidates Yet")
  })

  it("renders a fractional top score without misleading precision", () => {
    const metrics = calculateOverviewMetrics(
      [run("Pending", 10)],
      summary({ qualified: 1, topScore: 82.45 }),
      NOW,
    )

    expect(metric(metrics, "active-runs").note).toBe("Top Score 82.5")
  })

  it("treats only completed and cancelled runs as finished", () => {
    expect(isRunActive(run("Pending", 0))).toBe(true)
    expect(isRunActive(run("Running", 0))).toBe(true)
    expect(isRunActive(run("Completed", 0))).toBe(false)
    expect(isRunActive(run("Cancelled", 0))).toBe(false)
  })
})
