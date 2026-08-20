import { describe, expect, it } from "vitest"

import { DELETE } from "@/app/api/runs/[runId]/route"

describe("run deletion route", () => {
  it("requires server-side typed confirmation before deleting a run", async () => {
    const response = await DELETE(
      new Request("http://127.0.0.1:4310/api/runs/run-1", {
        method: "DELETE",
        headers: { host: "127.0.0.1:4310" },
      }),
      { params: Promise.resolve({ runId: "run-1" }) },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Type DELETE to confirm deleting this run.",
    })
  })
})
