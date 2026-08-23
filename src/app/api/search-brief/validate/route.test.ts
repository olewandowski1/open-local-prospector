import { describe, expect, it } from "vitest"

import { POST } from "@/app/api/search-brief/validate/route"

const validBrief = {
  location: "Kraków",
  category: "Dental clinics",
  targetCount: 10,
  mode: "Quick",
  runtime: "codex",
}

const requestWithBody = (body: string) =>
  new Request("http://127.0.0.1/api/search-brief/validate", {
    method: "POST",
    headers: { host: "127.0.0.1", "content-type": "application/json" },
    body,
  })

describe("POST /api/search-brief/validate", () => {
  it("returns the decoded Search Brief", async () => {
    const response = await POST(requestWithBody(JSON.stringify(validBrief)))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ valid: true, searchBrief: validBrief })
  })

  it("rejects unsupported runtimes", async () => {
    const response = await POST(
      requestWithBody(JSON.stringify({ ...validBrief, runtime: "openrouter" })),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ valid: false })
  })

  it("rejects malformed JSON", async () => {
    const response = await POST(requestWithBody("{"))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ valid: false })
  })
})
