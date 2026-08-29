import { describe, expect, it } from "vitest"
import {
  calculateOpportunityScore,
  observedDefectDensity,
  type PageDefectMeasurements,
  qualifiesOpportunityScore,
  REVIEW_QUEUE_THRESHOLD,
} from "@/features/review-queue/domain/opportunity-score"

const cleanPage: PageDefectMeasurements = {
  unlabeledControls: 0,
  imagesMissingAlt: 0,
  horizontalOverflow: false,
  usesHttps: true,
  firstContentfulPaintMs: 300,
}

const page = (overrides: Partial<PageDefectMeasurements> = {}): PageDefectMeasurements => ({
  ...cleanPage,
  ...overrides,
})

describe("observed defect density", () => {
  it("reports nothing when no page was captured", () => {
    expect(observedDefectDensity([])).toBe(0)
  })

  it("scores a clean page at nearly nothing", () => {
    expect(observedDefectDensity([cleanPage])).toBe(0)
  })

  // Averaging hid a slow home page behind three fast ones, so the worst page decides.
  it("reports the worst captured page and does not dilute it", () => {
    const defective = page({ unlabeledControls: 8 })
    expect(observedDefectDensity([defective])).toBe(0.4)
    expect(observedDefectDensity([defective, cleanPage, cleanPage, cleanPage])).toBe(0.4)
    expect(observedDefectDensity([cleanPage, page({ imagesMissingAlt: 8 })])).toBe(0.25)
  })

  it("ranks a heavier defect above a lighter one of the same kind", () => {
    expect(observedDefectDensity([page({ unlabeledControls: 6 })])).toBeGreaterThan(
      observedDefectDensity([page({ unlabeledControls: 2 })]),
    )
  })

  it("counts each measured defect kind", () => {
    expect(observedDefectDensity([page({ imagesMissingAlt: 8 })])).toBe(0.25)
    expect(observedDefectDensity([page({ horizontalOverflow: true })])).toBe(0.15)
    expect(observedDefectDensity([page({ usesHttps: false })])).toBe(0.2)
  })

  // The same home page measured 296 ms and 3,448 ms across runs, so paint time cannot move the score.
  it("ignores paint time, which varies with the network rather than the site", () => {
    expect(observedDefectDensity([page({ firstContentfulPaintMs: 30_000 })])).toBe(0)
  })

  it("stays bounded when every measurement is at its worst", () => {
    expect(
      observedDefectDensity([
        {
          unlabeledControls: 500,
          imagesMissingAlt: 500,
          horizontalOverflow: true,
          usesHttps: false,
          firstContentfulPaintMs: 60_000,
        },
      ]),
    ).toBe(1)
  })
})

describe("opportunity score", () => {
  it("uses the versioned weighted rubric", () => {
    expect(
      calculateOpportunityScore({
        severity: 5,
        observedPages: [
          {
            unlabeledControls: 8,
            imagesMissingAlt: 8,
            horizontalOverflow: true,
            usesHttps: false,
            firstContentfulPaintMs: 4_500,
          },
        ],
        hasContactRoute: true,
        localDecisionLikelihood: 1,
        apparentCommercialValue: 1,
        inspectionState: "Complete",
        corroboratingSources: 2,
      }),
    ).toMatchObject({
      total: 100,
      severity: 55,
      observedDefects: 10,
      contactRoute: 15,
      localDecisionLikelihood: 10,
      apparentCommercialValue: 10,
    })
  })

  // Having no website is the strongest opportunity class, so the contact route is what gates it.
  it("never qualifies a business with no website and no way to reach it", () => {
    const score = calculateOpportunityScore({
      severity: 5,
      observedPages: [],
      hasContactRoute: false,
      localDecisionLikelihood: 0,
      apparentCommercialValue: 0,
      inspectionState: "NoWebsite",
      corroboratingSources: 2,
    })
    expect(score.observedDefects).toBe(10)
    expect(
      qualifiesOpportunityScore(score, {
        hasOpportunity: true,
        hasObservation: true,
        hasContactRoute: false,
        suppressed: false,
      }),
    ).toBe(false)
  })

  it("claims nothing about pages a blocked inspection never captured", () => {
    expect(
      calculateOpportunityScore({
        severity: 5,
        observedPages: [],
        hasContactRoute: true,
        localDecisionLikelihood: 1,
        apparentCommercialValue: 0,
        inspectionState: "Blocked",
        corroboratingSources: 2,
      }).observedDefects,
    ).toBe(0)
  })

  it("handles invalid components deterministically", () => {
    expect(
      calculateOpportunityScore({
        severity: Number.NaN,
        observedPages: [],
        hasContactRoute: false,
        localDecisionLikelihood: 2,
        apparentCommercialValue: 0,
        inspectionState: "Complete",
        corroboratingSources: 2,
      }).total,
    ).toBe(10)
  })

  it("requires threshold, evidence, contact, and no suppression", () => {
    const score = calculateOpportunityScore({
      severity: 4,
      observedPages: [cleanPage],
      hasContactRoute: true,
      localDecisionLikelihood: 1,
      apparentCommercialValue: 0.3,
      inspectionState: "Complete",
      corroboratingSources: 2,
    })
    expect(score.total).toBe(REVIEW_QUEUE_THRESHOLD)
    expect(
      qualifiesOpportunityScore(score, {
        hasOpportunity: true,
        hasObservation: true,
        hasContactRoute: true,
        suppressed: false,
      }),
    ).toBe(true)
    for (const missing of ["hasOpportunity", "hasObservation", "hasContactRoute"] as const) {
      expect(
        qualifiesOpportunityScore(score, {
          hasOpportunity: true,
          hasObservation: true,
          hasContactRoute: true,
          suppressed: false,
          [missing]: false,
        }),
      ).toBe(false)
    }
    expect(
      qualifiesOpportunityScore(score, {
        hasOpportunity: true,
        hasObservation: true,
        hasContactRoute: true,
        suppressed: true,
      }),
    ).toBe(false)
  })

  it("limits fully blocked inspections without excluding promising businesses", () => {
    expect(
      calculateOpportunityScore({
        severity: 5,
        observedPages: [],
        hasContactRoute: true,
        localDecisionLikelihood: 1,
        apparentCommercialValue: 0.75,
        inspectionState: "Blocked",
        corroboratingSources: 2,
      }),
    ).toMatchObject({
      severity: 44,
      // Nothing was observed, so nothing is claimed about the pages.
      observedDefects: 0,
      total: 76.5,
    })
  })

  // One directory listing that did not mention a website had been scoring 98, the top of the queue.
  it("caps an absent website nobody corroborated, and scores a corroborated one in full", () => {
    const absent = (corroboratingSources: number) =>
      calculateOpportunityScore({
        severity: 5,
        observedPages: [],
        hasContactRoute: true,
        localDecisionLikelihood: 1,
        apparentCommercialValue: 0.7,
        inspectionState: "NoWebsite",
        corroboratingSources,
      })

    expect(absent(2).severity).toBe(55)
    expect(absent(1).severity).toBe(44)
    expect(absent(1).total).toBeLessThan(absent(2).total)
    // Still a strong lead, just not a confirmed one.
    expect(absent(1).total).toBeGreaterThan(REVIEW_QUEUE_THRESHOLD)
  })

  it("separates two sites the runtime placed in one severity band", () => {
    const inputs = {
      severity: 3,
      hasContactRoute: true,
      localDecisionLikelihood: 1,
      apparentCommercialValue: 0.8,
      inspectionState: "Complete" as const,
      corroboratingSources: 2,
    }
    const worse = calculateOpportunityScore({
      ...inputs,
      observedPages: [page({ unlabeledControls: 9 }), page({ unlabeledControls: 9 })],
    })
    const better = calculateOpportunityScore({
      ...inputs,
      observedPages: [page({ unlabeledControls: 2 }), page({ unlabeledControls: 2 })],
    })
    expect(worse.total).toBeGreaterThan(better.total)
    expect(worse.total - better.total).toBeCloseTo(3, 5)
  })
})
