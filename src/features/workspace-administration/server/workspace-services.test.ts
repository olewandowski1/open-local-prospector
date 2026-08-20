import { describe, expect, it } from "vitest"

import { assertSameOrigin } from "@/features/workspace-administration/server/workspace-services"

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
