import { describe, expect, it } from "vitest"

import {
  assertSameOrigin,
  isLoopbackRequest,
} from "@/features/workspace-administration/server/workspace-services"

describe("workspace mutation origin guard", () => {
  it("accepts the browser origin matching the request Host header", () => {
    expect(() =>
      assertSameOrigin(
        new Request("http://internal:4310/api/workspace/reset", {
          headers: { host: "127.0.0.1:4311", origin: "http://127.0.0.1:4311" },
        }),
      ),
    ).not.toThrow()
  })

  it("accepts a non-browser request without Origin", () => {
    expect(() =>
      assertSameOrigin(
        new Request("http://127.0.0.1:4310/api/workspace/reset", {
          headers: { host: "127.0.0.1:4310" },
        }),
      ),
    ).not.toThrow()
  })

  it("accepts localhost with a matching browser origin", () => {
    expect(() =>
      assertSameOrigin(
        new Request("http://localhost:4310/api/workspace/reset", {
          headers: { host: "localhost:4310", origin: "http://localhost:4310" },
        }),
      ),
    ).not.toThrow()
  })

  it("refuses a matching attacker Origin and Host", () => {
    expect(() =>
      assertSameOrigin(
        new Request("http://attacker.example/api/workspace/reset", {
          headers: { host: "attacker.example", origin: "http://attacker.example" },
        }),
      ),
    ).toThrow("Local application request refused.")
  })

  it.each(["[::1]:4310", "127.0.0.2:4310", "127.0.0.1:65536"])(
    "refuses non-product Host %s",
    (host) => {
      expect(
        isLoopbackRequest(
          new Request("http://127.0.0.1:4310/api/workspace/reset", { headers: { host } }),
        ),
      ).toBe(false)
    },
  )

  it.each(["https://attacker.example", "not a URL"])("refuses origin %s", (origin) => {
    expect(() =>
      assertSameOrigin(
        new Request("http://127.0.0.1:4310/api/workspace/reset", {
          headers: { host: "127.0.0.1:4310", origin },
        }),
      ),
    ).toThrow("Cross-origin request refused.")
  })
})
