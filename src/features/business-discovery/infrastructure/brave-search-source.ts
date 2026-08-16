import { Effect } from "effect"

import type { DiscoverySource } from "@/features/business-discovery/application/discovery-source"
import { DiscoverySourceError } from "@/features/business-discovery/application/discovery-source"
import {
  type DiscoveryPage,
  type DiscoveryResult,
  type DiscoverySearchRequest,
  normalizeDiscoveryUrl,
} from "@/features/business-discovery/domain/discovered-business"

const DEFAULT_ENDPOINT = "https://api.search.brave.com/res/v1/web/search"
const MAXIMUM_RESPONSE_BYTES = 1_048_576

type Fetch = typeof globalThis.fetch

export function makeBraveSearchSource(
  apiKey: string | undefined,
  fetch_: Fetch = globalThis.fetch,
  endpoint = process.env.PROSPECTOR_BRAVE_SEARCH_URL ?? DEFAULT_ENDPOINT,
): DiscoverySource {
  const token = apiKey?.trim()
  return {
    identifier: "brave-web-search",
    search: (request) => {
      const validation = validateRequest(request)
      if (validation) return Effect.fail(validation)
      if (!token) {
        return Effect.fail(
          new DiscoverySourceError({
            classification: "Blocked",
            code: "brave-search-not-configured",
            message: "Brave Search is not configured for this local worker.",
          }),
        )
      }
      return Effect.tryPromise({
        try: async () => {
          const url = new URL(endpoint)
          url.searchParams.set("q", request.query)
          url.searchParams.set("count", String(request.count))
          url.searchParams.set("offset", String(request.offset))
          url.searchParams.set("country", request.country)
          url.searchParams.set("search_lang", request.searchLanguage)
          url.searchParams.set("ui_lang", `${request.searchLanguage}-${request.country}`)
          url.searchParams.set("safesearch", "strict")
          url.searchParams.set("spellcheck", "true")

          const response = await fetch_(url, {
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip",
              "X-Subscription-Token": token,
            },
            signal: AbortSignal.timeout(10_000),
          })
          if (!response.ok) throw responseError(response.status)
          const declaredLength = Number(response.headers.get("content-length") ?? 0)
          if (declaredLength > MAXIMUM_RESPONSE_BYTES) throw invalidResponse()
          const body = await response.text()
          if (Buffer.byteLength(body) > MAXIMUM_RESPONSE_BYTES) throw invalidResponse()
          return parseResponse(body, request.count)
        },
        catch: (error) =>
          error instanceof DiscoverySourceError
            ? error
            : new DiscoverySourceError({
                classification: "Transient",
                code: "brave-search-unreachable",
                message: "Brave Search could not be reached; the query can be retried.",
              }),
      })
    },
  }
}

function validateRequest(request: DiscoverySearchRequest): DiscoverySourceError | undefined {
  const words = request.query.trim().split(/\s+/u)
  if (
    request.query.trim() === "" ||
    request.query.length > 400 ||
    words.length > 50 ||
    !Number.isInteger(request.count) ||
    request.count < 1 ||
    request.count > 20 ||
    !Number.isInteger(request.offset) ||
    request.offset < 0 ||
    request.offset > 9
  ) {
    return new DiscoverySourceError({
      classification: "Permanent",
      code: "invalid-discovery-query",
      message: "The application generated a discovery query outside Brave Search limits.",
    })
  }
  return undefined
}

function responseError(status: number): DiscoverySourceError {
  if (status === 429 || status >= 500) {
    return new DiscoverySourceError({
      classification: "Transient",
      code: status === 429 ? "brave-search-rate-limited" : "brave-search-unavailable",
      message: "Brave Search temporarily rejected the request; the query can be retried.",
    })
  }
  return new DiscoverySourceError({
    classification: "Permanent",
    code:
      status === 401 || status === 403
        ? "brave-search-authorization-failed"
        : "brave-search-rejected",
    message: "Brave Search rejected the bounded discovery request.",
  })
}

function invalidResponse(): DiscoverySourceError {
  return new DiscoverySourceError({
    classification: "Infrastructure",
    code: "brave-search-invalid-response",
    message: "Brave Search returned an invalid or oversized response.",
  })
}

function parseResponse(body: string, limit: number): DiscoveryPage {
  let value: unknown
  try {
    value = JSON.parse(body)
  } catch {
    throw invalidResponse()
  }
  if (!isRecord(value)) throw invalidResponse()
  const query = isRecord(value.query) ? value.query : undefined
  const web = isRecord(value.web) ? value.web : undefined
  const rawResults = web?.results
  if (rawResults !== undefined && !Array.isArray(rawResults)) throw invalidResponse()
  const results = (rawResults ?? []).slice(0, limit).flatMap(parseResult)
  return { results, moreResults: query?.more_results_available === true }
}

function parseResult(value: unknown): readonly DiscoveryResult[] {
  if (!isRecord(value) || typeof value.title !== "string" || typeof value.url !== "string")
    return []
  const url = normalizeDiscoveryUrl(value.url)
  const title = value.title.trim().slice(0, 500)
  if (!url || title === "") return []
  const description =
    typeof value.description === "string" ? value.description.trim().slice(0, 2_000) : undefined
  return [
    {
      sourceIdentifier: `web:${url}`,
      title,
      url,
      ...(description ? { description } : {}),
      attributes: {
        title,
        url,
        ...(description ? { description } : {}),
      },
    },
  ]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
