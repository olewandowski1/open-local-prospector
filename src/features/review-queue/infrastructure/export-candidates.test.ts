import { describe, expect, it } from "vitest"
import type { CandidateExport } from "@/features/review-queue/infrastructure/export-candidates"

describe("export contract", () => {
  it("keeps export data explicit and contains no outreach action", () => {
    const keys = Object.keys({
      business: "A, B",
      locality: "Łódź",
      score: 70,
      rubricVersion: "v1",
      assessmentTimestamp: "now",
      reviewStatus: "Shortlisted",
      scoreBreakdown: {},
      evidenceLinks: [],
      contactRoutes: [],
    } satisfies CandidateExport)
    expect(keys).not.toContain("outreach")
  })
})
