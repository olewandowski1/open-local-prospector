import { describe, expect, it } from "vitest"
import {
  calculateOverviewMetrics,
  type OverviewCandidateSummary,
  type OverviewMetric,
  type OverviewRunSnapshot,
} from "@/features/overview/domain/overview-metrics"

const run = (values: Partial<OverviewRunSnapshot> = {}): OverviewRunSnapshot => ({
  discoveries: 0,
  activeRuns: 0,
  discoveriesThisWeek: 0,
  discoveriesLastWeek: 0,
  hasRuns: true,
  ...values,
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
      run({ discoveries: 66, activeRuns: 1, discoveriesThisWeek: 66 }),
      summary({ qualified: 19, unreviewed: 6, shortlisted: 4, topScore: 91 }),
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
      run({ discoveries: 14, discoveriesThisWeek: 10, discoveriesLastWeek: 4 }),
      summary({ qualified: 5, qualifiedThisWeek: 4, qualifiedLastWeek: 1 }),
    )

    expect(metric(metrics, "discovered")).toMatchObject({ trend: "up", note: "+6 This Week" })
    expect(metric(metrics, "qualified")).toMatchObject({ trend: "up", note: "+3 This Week" })
  })

  it("points the arrow down when a week is quieter than the last", () => {
    const metrics = calculateOverviewMetrics(
      run({ discoveries: 11, discoveriesThisWeek: 2, discoveriesLastWeek: 9 }),
      summary({ qualified: 3, qualifiedThisWeek: 0, qualifiedLastWeek: 3 }),
    )

    expect(metric(metrics, "discovered")).toMatchObject({ trend: "down", note: "-7 This Week" })
    expect(metric(metrics, "qualified")).toMatchObject({ trend: "down", note: "-3 This Week" })
  })

  it("reports a flat week rather than an arrow when nothing moved", () => {
    const metrics = calculateOverviewMetrics(
      run({ discoveries: 10, discoveriesThisWeek: 5, discoveriesLastWeek: 5 }),
      summary({ qualified: 2, qualifiedThisWeek: 1, qualifiedLastWeek: 1 }),
    )

    expect(metric(metrics, "discovered")).toMatchObject({
      trend: "flat",
      note: "No Change This Week",
    })
  })

  it("ignores runs older than the two comparison windows", () => {
    const metrics = calculateOverviewMetrics(
      run({ discoveries: 43, discoveriesThisWeek: 3 }),
      summary({ qualified: 1 }),
    )

    expect(metric(metrics, "discovered")).toMatchObject({ value: "43", note: "+3 This Week" })
  })

  it("expresses qualification as a share of discovered businesses", () => {
    const metrics = calculateOverviewMetrics(
      run({ discoveries: 40, discoveriesThisWeek: 40 }),
      summary({ qualified: 10, unreviewed: 3, shortlisted: 1 }),
    )

    expect(metric(metrics, "awaiting-review")).toMatchObject({
      value: "3",
      note: "1 Shortlisted",
      trend: "none",
    })
  })

  it("shows no arrow and no invented comparison before any run exists", () => {
    const metrics = calculateOverviewMetrics(run({ hasRuns: false }), summary({}))

    expect(metrics.map((item) => item.value)).toEqual(["0", "0", "0", "0"])
    expect(metrics.every((item) => item.trend === "none")).toBe(true)
    expect(metric(metrics, "discovered").note).toBe("No Runs Yet")
    expect(metric(metrics, "qualified").note).toBe("Nothing Discovered Yet")
    expect(metric(metrics, "awaiting-review").note).toBe("Nothing To Review Yet")
    expect(metric(metrics, "active-runs").note).toBe("No Scored Candidates Yet")
  })

  it("renders a fractional top score without misleading precision", () => {
    const metrics = calculateOverviewMetrics(
      run({ discoveries: 10, activeRuns: 1, discoveriesThisWeek: 10 }),
      summary({ qualified: 1, topScore: 82.45 }),
    )

    expect(metric(metrics, "active-runs").note).toBe("Top Score 82.5")
  })
})
