import { describe, expect, it } from "vitest"

import { safeLogUrl } from "@/features/website-inspection/infrastructure/playwright-inspection-policy"

describe("Playwright inspection logging policy", () => {
  it("removes credentials, fragments, and secret-looking query values", () => {
    expect(
      safeLogUrl("https://user:pass@example.com/path?token=secret&category=dentist#private"),
    ).toBe("https://example.com/path?token=%5Bredacted%5D&category=dentist")
  })

  it.each([
    ["javascript:alert(1)", "blocked:unsafe-url"],
    ["not a url", "blocked:invalid-url"],
  ])("does not log unsafe destinations", (input, expected) => {
    expect(safeLogUrl(input)).toBe(expected)
  })
})
