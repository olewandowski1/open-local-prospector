import { Effect } from "effect"
import { describe, expect, it, vi } from "vitest"

import { makeBraveSearchSource } from "@/features/business-discovery/infrastructure/brave-search-source"

const request = {
  query: "stomatolog Kraków",
  count: 2,
  offset: 1,
  country: "PL",
  searchLanguage: "pl",
} as const

describe("Brave Search discovery source", () => {
  it("keeps the token in the worker request and bounds normalized web results", async () => {
    const fetch_ = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          query: { more_results_available: true },
          web: {
            results: [
              {
                title: " Gabinet A ",
                url: "HTTPS://EXAMPLE.COM/a/#offer",
                description: " Public text ",
              },
              { title: "Gabinet B", url: "https://example.com/b" },
              { title: "Ignored by count", url: "https://example.com/c" },
            ],
          },
        }),
        { status: 200 },
      ),
    )

    const page = await Effect.runPromise(
      makeBraveSearchSource("top-secret", fetch_, "https://brave.test/search").search(request),
    )

    expect(page).toEqual({
      moreResults: true,
      results: [
        {
          sourceIdentifier: "web:https://example.com/a",
          title: "Gabinet A",
          url: "https://example.com/a",
          description: "Public text",
          attributes: {
            title: "Gabinet A",
            url: "https://example.com/a",
            description: "Public text",
          },
        },
        {
          sourceIdentifier: "web:https://example.com/b",
          title: "Gabinet B",
          url: "https://example.com/b",
          attributes: { title: "Gabinet B", url: "https://example.com/b" },
        },
      ],
    })
    const [url, init] = fetch_.mock.calls[0] ?? []
    expect(String(url)).toContain("count=2")
    expect(String(url)).toContain("offset=1")
    expect(String(url)).not.toContain("top-secret")
    expect(init?.headers).toMatchObject({ "X-Subscription-Token": "top-secret" })
  })

  it("rejects out-of-contract requests before calling Brave", async () => {
    const fetch_ = vi.fn<typeof fetch>()
    const result = await Effect.runPromise(
      Effect.either(makeBraveSearchSource("secret", fetch_).search({ ...request, count: 21 })),
    )
    expect(result).toMatchObject({ left: { code: "invalid-discovery-query" } })
    expect(fetch_).not.toHaveBeenCalled()
  })

  it.each([
    [429, "Transient", "brave-search-rate-limited"],
    [503, "Transient", "brave-search-unavailable"],
    [401, "Permanent", "brave-search-authorization-failed"],
    [422, "Permanent", "brave-search-rejected"],
  ] as const)(
    "classifies HTTP %i without exposing response text",
    async (status, classification, code) => {
      const fetch_ = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("dangerous upstream text", { status }))
      const result = await Effect.runPromise(
        Effect.either(makeBraveSearchSource("secret", fetch_).search(request)),
      )
      expect(result).toMatchObject({ left: { classification, code } })
      expect(JSON.stringify(result)).not.toContain("dangerous upstream text")
      expect(JSON.stringify(result)).not.toContain("secret")
    },
  )

  it("blocks cleanly when the server-side token is absent", async () => {
    const result = await Effect.runPromise(
      Effect.either(makeBraveSearchSource(undefined, vi.fn<typeof fetch>()).search(request)),
    )
    expect(result).toMatchObject({
      left: { classification: "Blocked", code: "brave-search-not-configured" },
    })
  })
})
