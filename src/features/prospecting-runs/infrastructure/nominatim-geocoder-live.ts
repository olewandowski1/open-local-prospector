import Database from "better-sqlite3"
import { Effect, Layer } from "effect"

import {
  GeocodingError,
  SearchAreaGeocoder,
} from "@/features/prospecting-runs/application/search-brief-preflight"
import type { SearchArea } from "@/features/prospecting-runs/domain/search-brief"

const CACHE_TTL_MILLISECONDS = 7 * 24 * 60 * 60 * 1_000
const MAXIMUM_RESPONSE_BYTES = 256 * 1_024
const REQUEST_INTERVAL_MILLISECONDS = 1_000
let nextRequestAt = 0

type Fetch = typeof globalThis.fetch

export const nominatimGeocoderLive = (
  databasePath: string,
  fetch_: Fetch = globalThis.fetch,
  endpoint = process.env.PROSPECTOR_GEOCODER_URL ?? "https://nominatim.openstreetmap.org/search",
) =>
  Layer.succeed(SearchAreaGeocoder, {
    search: (location) => searchNominatim(databasePath, fetch_, endpoint, location),
  })

export function searchNominatim(
  databasePath: string,
  fetch_: Fetch,
  endpoint: string,
  location: string,
): Effect.Effect<readonly SearchArea[], GeocodingError> {
  return Effect.gen(function* () {
    const query = location.trim().toLocaleLowerCase("en")
    const cached = yield* Effect.sync(() => readCacheSafely(databasePath, query))
    if (cached) return cached

    const delay = yield* Effect.sync(() => {
      const now = Date.now()
      const scheduledAt = Math.max(now, nextRequestAt)
      nextRequestAt = scheduledAt + REQUEST_INTERVAL_MILLISECONDS
      return scheduledAt - now
    })
    if (delay > 0) yield* Effect.sleep(delay)

    const url = new URL(endpoint)
    url.searchParams.set("q", location)
    url.searchParams.set("format", "jsonv2")
    url.searchParams.set("addressdetails", "1")
    url.searchParams.set("accept-language", "pl,en")
    url.searchParams.set("limit", "5")

    const areas = yield* Effect.tryPromise({
      try: async () => {
        const response = await fetch_(url, {
          headers: { "User-Agent": "OpenLocalProspector/0.1 (local application)" },
          signal: AbortSignal.timeout(5_000),
        })
        if (!response.ok) throw new Error("geocoder request failed")
        const length = Number(response.headers.get("content-length") ?? 0)
        if (length > MAXIMUM_RESPONSE_BYTES) throw new Error("geocoder response too large")
        const body = await response.text()
        if (Buffer.byteLength(body) > MAXIMUM_RESPONSE_BYTES) {
          throw new Error("geocoder response too large")
        }
        return parseNominatimResponse(body)
      },
      catch: () => new GeocodingError({ reason: "unreachable" }),
    })

    yield* Effect.sync(() => writeCacheSafely(databasePath, query, areas))
    return areas
  })
}

function parseNominatimResponse(body: string): readonly SearchArea[] {
  const value: unknown = JSON.parse(body)
  if (!Array.isArray(value)) throw new Error("unsupported geocoder response")
  return value.slice(0, 5).map((candidate) => {
    if (!isRecord(candidate) || !isRecord(candidate.address)) {
      throw new Error("unsupported geocoder response")
    }
    const id = `${requiredString(candidate, "osm_type")}:${requiredString(candidate, "osm_id")}`
    const latitude = Number(requiredString(candidate, "lat"))
    const longitude = Number(requiredString(candidate, "lon"))
    const countryCode = requiredString(candidate.address, "country_code").toUpperCase()
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || countryCode.length !== 2) {
      throw new Error("unsupported geocoder response")
    }
    return {
      id,
      displayName: requiredString(candidate, "display_name"),
      latitude,
      longitude,
      countryCode,
    }
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if ((typeof value !== "string" && typeof value !== "number") || String(value).trim() === "") {
    throw new Error("unsupported geocoder response")
  }
  return String(value)
}

function readCache(databasePath: string, query: string): readonly SearchArea[] | undefined {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true })
  try {
    const row = database
      .prepare("select results from geocoding_cache where query = ? and expires_at > ?")
      .get(query, Date.now()) as { results: string } | undefined
    return row ? (JSON.parse(row.results) as readonly SearchArea[]) : undefined
  } finally {
    database.close()
  }
}

function readCacheSafely(databasePath: string, query: string): readonly SearchArea[] | undefined {
  try {
    return readCache(databasePath, query)
  } catch {
    return undefined
  }
}

function writeCache(databasePath: string, query: string, areas: readonly SearchArea[]): void {
  const database = new Database(databasePath, { fileMustExist: true })
  try {
    database
      .prepare(
        `insert into geocoding_cache (query, results, expires_at) values (?, ?, ?)
         on conflict(query) do update set results = excluded.results, expires_at = excluded.expires_at`,
      )
      .run(query, JSON.stringify(areas), Date.now() + CACHE_TTL_MILLISECONDS)
  } finally {
    database.close()
  }
}

function writeCacheSafely(databasePath: string, query: string, areas: readonly SearchArea[]): void {
  try {
    writeCache(databasePath, query, areas)
  } catch {
    // A cache write failure must not discard a valid geocoding response.
  }
}
