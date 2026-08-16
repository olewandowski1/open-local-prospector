import Database from "better-sqlite3"
import { Effect } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"

import { searchNominatim } from "@/features/prospecting-runs/infrastructure/nominatim-geocoder-live"
import { createMigratedTestDatabase } from "@/test-support/local-database"

const databases: ReturnType<typeof createMigratedTestDatabase>[] = []
afterEach(() => {
  for (const database of databases.splice(0)) database.cleanup()
})

describe("Nominatim geocoder", () => {
  it("identifies itself, bounds results, and caches user-triggered searches", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const fetch_ = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            osm_type: "relation",
            osm_id: 276892,
            lat: "50.0614",
            lon: "19.9366",
            display_name: "Kraków, Polska",
            address: { country_code: "pl" },
          },
        ]),
        { status: 200 },
      ),
    )

    const first = await Effect.runPromise(
      searchNominatim(database.path, fetch_, "https://example.test/search", "Kraków, Poland"),
    )
    const second = await Effect.runPromise(
      searchNominatim(database.path, fetch_, "https://example.test/search", "Kraków, Poland"),
    )

    expect(first[0]).toMatchObject({ countryCode: "PL", id: "relation:276892" })
    expect(second).toEqual(first)
    expect(fetch_).toHaveBeenCalledTimes(1)
    expect(fetch_.mock.calls[0]?.[1]?.headers).toMatchObject({
      "User-Agent": expect.stringContaining("OpenLocalProspector"),
    })
  })

  it("stores no location defaults while caching only the explicit geocoding query", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const sqlite = new Database(database.path, { readonly: true })
    try {
      const columns = sqlite.prepare("pragma table_info(geocoding_cache)").all()
      expect(columns).toHaveLength(3)
    } finally {
      sqlite.close()
    }
  })
})
