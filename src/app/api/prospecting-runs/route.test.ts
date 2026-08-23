import { beforeEach, describe, expect, it, vi } from "vitest"

const { createConfirmedProspectingRun } = vi.hoisted(() => ({
  createConfirmedProspectingRun: vi.fn(),
}))

vi.mock("@/features/prospecting-runs/server/search-brief-services", () => ({
  createConfirmedProspectingRun,
}))

import { POST } from "@/app/api/prospecting-runs/route"

describe("Prospecting Run creation route", () => {
  beforeEach(() => createConfirmedProspectingRun.mockReset())

  it("rejects a foreign browser Origin before reading or creating the run", async () => {
    const response = await POST(
      new Request("http://127.0.0.1:4310/api/prospecting-runs", {
        method: "POST",
        headers: {
          host: "127.0.0.1:4310",
          origin: "https://attacker.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    )

    expect(response.status).toBe(400)
    expect(createConfirmedProspectingRun).not.toHaveBeenCalled()
  })
})
