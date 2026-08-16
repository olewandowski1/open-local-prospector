import { describe, expect, it } from "vitest"
import { updateCandidateReview } from "@/features/review-queue/application/review-candidate"

describe("candidate review validation", () => {
  it("requires a reason for rejection", () => {
    expect(() => updateCandidateReview("missing.sqlite", "score", { status: "Rejected" })).toThrow(
      "rejection reason",
    )
  })
  it("requires an explanation for Other", () => {
    expect(() =>
      updateCandidateReview("missing.sqlite", "score", {
        status: "Rejected",
        rejectionReason: "Other",
      }),
    ).toThrow("Other requires")
  })
})
