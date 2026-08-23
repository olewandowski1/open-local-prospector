import { describe, expect, it } from "vitest"
import {
  calculateOpportunityScore,
  qualifiesOpportunityScore,
  REVIEW_QUEUE_THRESHOLD,
} from "@/features/review-queue/domain/opportunity-score"

describe("opportunity score", () => {
  it("uses the versioned weighted rubric", () => {
    expect(
      calculateOpportunityScore({
        severity: 5,
        observationConfidence: 1,
        hasContactRoute: true,
        localDecisionLikelihood: 1,
        apparentCommercialValue: 1,
      }),
    ).toMatchObject({
      total: 100,
      severity: 40,
      observationConfidence: 25,
      contactRoute: 15,
      localDecisionLikelihood: 10,
      apparentCommercialValue: 10,
    })
  })
  it("does not let no-site severity alone cross the threshold", () => {
    expect(
      calculateOpportunityScore({
        severity: 5,
        observationConfidence: 0,
        hasContactRoute: false,
        localDecisionLikelihood: 0,
        apparentCommercialValue: 0,
      }).total,
    ).toBeLessThan(REVIEW_QUEUE_THRESHOLD)
  })
  it("handles invalid components deterministically", () => {
    expect(
      calculateOpportunityScore({
        severity: Number.NaN,
        observationConfidence: -1,
        hasContactRoute: false,
        localDecisionLikelihood: 2,
        apparentCommercialValue: 0,
      }).total,
    ).toBe(10)
  })
  it("requires threshold, evidence, contact, and no suppression", () => {
    const score = calculateOpportunityScore({
      severity: 2,
      observationConfidence: 0.6,
      hasContactRoute: true,
      localDecisionLikelihood: 1,
      apparentCommercialValue: 0.4,
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
})
