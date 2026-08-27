import { beforeEach, describe, expect, it, vi } from "vitest"

const { getReassessmentTarget, createReassessmentRun } = vi.hoisted(() => ({
  getReassessmentTarget: vi.fn(),
  createReassessmentRun: vi.fn(),
}))
vi.mock("@/features/review-queue/server/review-queue-read-model", () => ({
  getReassessmentTarget,
}))
vi.mock("@/features/prospecting-runs/server/reassessment-services", () => ({
  createReassessmentRun,
  RuntimeNotReadyForReassessment: class RuntimeNotReadyForReassessment extends Error {},
}))

import { POST } from "@/app/api/review/[scoreId]/reassess/route"

const request = () =>
  new Request("http://localhost/api/review/score-1/reassess", {
    method: "POST",
    headers: { host: "localhost" },
  })
const params = { params: Promise.resolve({ scoreId: "score-1" }) }

const target = {
  canonicalBusinessId: "business-1",
  businessName: "Gabinet Uśmiech",
  sourceSearchBrief: { runtime: "codex" },
}

describe("candidate reassessment route", () => {
  beforeEach(() => {
    getReassessmentTarget.mockReset()
    createReassessmentRun.mockReset()
  })

  it("starts a run for the business behind the score", async () => {
    getReassessmentTarget.mockReturnValueOnce(target)
    createReassessmentRun.mockResolvedValueOnce({ id: "run-1", state: "Pending" })

    const response = await POST(request(), params)

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ id: "run-1", state: "Pending" })
    // Repeating the request must reuse the run this score already asked for.
    expect(createReassessmentRun).toHaveBeenCalledWith(
      expect.objectContaining({ canonicalBusinessId: "business-1", requestId: "reassess:score-1" }),
    )
  })

  it("reports a missing candidate rather than starting a run", async () => {
    getReassessmentTarget.mockReturnValueOnce(undefined)

    const response = await POST(request(), params)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "Candidate not found." })
    expect(createReassessmentRun).not.toHaveBeenCalled()
  })

  it("refuses a request that does not come from the local application", async () => {
    const response = await POST(
      new Request("http://localhost/api/review/score-1/reassess", { method: "POST" }),
      params,
    )

    expect(response.status).toBe(400)
    expect(createReassessmentRun).not.toHaveBeenCalled()
  })
})
