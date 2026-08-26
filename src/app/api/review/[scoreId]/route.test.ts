import { beforeEach, describe, expect, it, vi } from "vitest"

const { getQueueCandidate } = vi.hoisted(() => ({ getQueueCandidate: vi.fn() }))
vi.mock("@/features/review-queue/server/review-queue-read-model", () => ({ getQueueCandidate }))

import { GET } from "@/app/api/review/[scoreId]/route"

describe("candidate detail route", () => {
  beforeEach(() => getQueueCandidate.mockReset())

  it("keeps a missing candidate distinct from a read failure", async () => {
    getQueueCandidate.mockReturnValueOnce(undefined)
    const missing = await GET(new Request("http://localhost/api/review/missing"), {
      params: Promise.resolve({ scoreId: "missing" }),
    })
    expect(missing.status).toBe(404)
    await expect(missing.json()).resolves.toEqual({ error: "Candidate not found." })

    getQueueCandidate.mockImplementationOnce(() => {
      throw new Error("database unavailable")
    })
    const failed = await GET(new Request("http://localhost/api/review/failing"), {
      params: Promise.resolve({ scoreId: "failing" }),
    })
    expect(failed.status).toBe(500)
    await expect(failed.json()).resolves.toEqual({ error: "Candidate details could not be read." })
  })
})
