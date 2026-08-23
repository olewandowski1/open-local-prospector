import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server"
import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"

import { config, proxy } from "@/proxy"

describe("API proxy", () => {
  it.each(["/api/workspace/backup", "/api/export", "/api/runs/run-1/control"])(
    "matches %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true)
    },
  )

  it.each(["/", "/runs/run-1", "/_next/static/app.js"])("does not match %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false)
  })

  it("refuses a hostile Host before an API route runs", async () => {
    const response = proxy(
      new NextRequest("http://attacker.example/api/export", {
        headers: { host: "attacker.example" },
      }),
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Local API request refused." })
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
