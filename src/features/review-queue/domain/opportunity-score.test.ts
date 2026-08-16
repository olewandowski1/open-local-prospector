import { describe, expect, it } from "vitest"
import {
  calculateOpportunityScore,
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
})
