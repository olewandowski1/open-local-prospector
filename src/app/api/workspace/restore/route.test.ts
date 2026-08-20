import { describe, expect, it } from "vitest"

import { POST } from "@/app/api/workspace/restore/route"

describe("workspace restore route", () => {
  it("requires server-side typed confirmation before accepting an upload", async () => {
    const response = await POST(
      new Request("http://127.0.0.1:4310/api/workspace/restore", {
        method: "POST",
        headers: { host: "127.0.0.1:4310", "content-type": "application/octet-stream" },
        body: new Uint8Array([1]),
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Type RESTORE to confirm replacing the workspace.",
    })
  })
})
