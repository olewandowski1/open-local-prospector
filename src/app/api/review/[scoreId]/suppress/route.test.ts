import { describe, expect, it } from "vitest"

import { POST } from "@/app/api/review/[scoreId]/suppress/route"
import { MAX_SUPPRESSION_REASON_LENGTH } from "@/features/review-queue/domain/review-policy"

describe("candidate suppression route", () => {
  it("rejects an over-limit reason before opening the workspace", async () => {
    const response = await POST(
      new Request("http://localhost/api/review/score/suppress", {
        method: "POST",
        headers: { "content-type": "application/json", host: "localhost" },
        body: JSON.stringify({ reason: "x".repeat(MAX_SUPPRESSION_REASON_LENGTH + 1) }),
      }),
      { params: Promise.resolve({ scoreId: "score" }) },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Suppression reason is too long." })
  })
})
