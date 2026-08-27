import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server"
import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"

import { config, proxy } from "@/proxy"

describe("local application proxy", () => {
  it.each([
    "/",
    "/review",
    "/runs/run-1",
    "/api/workspace/backup",
    "/api/export",
    "/api/runs/run-1/control",
  ])("matches %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true)
  })

  it.each(["/_next/static/app.js", "/_next/image?url=%2Ficon.svg&w=64&q=75"])(
    "does not match %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false)
    },
  )

  it("refuses a hostile Host before a dynamic page renders", async () => {
    const response = proxy(
      new NextRequest("http://attacker.example/review", {
        headers: { host: "attacker.example" },
      }),
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Local application request refused." })
  })

  it("continues a request for the configured loopback Host", () => {
    const response = proxy(
      new NextRequest("http://127.0.0.1:4310/api/export", {
        headers: { host: "127.0.0.1:4310" },
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })
})
