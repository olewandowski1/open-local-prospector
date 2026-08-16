import { Effect, Option } from "effect"
import { afterEach, describe, expect, it } from "vitest"

import {
  getSearchBriefDefaults,
  startProspectingRun,
} from "@/features/prospecting-runs/application/prospecting-run"
import { sqliteProspectingRunRepositoryLive } from "@/features/prospecting-runs/infrastructure/sqlite-prospecting-run-repository"
import { createMigratedTestDatabase } from "@/test-support/local-database"

const databases: ReturnType<typeof createMigratedTestDatabase>[] = []
afterEach(() => {
  for (const database of databases.splice(0)) database.cleanup()
})

describe("SQLite Prospecting Run repository", () => {
  it("persists one pending run and restores only non-location defaults", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const layer = sqliteProspectingRunRepositoryLive(database.path)
    const input = {
      location: "Kraków",
      radiusKm: 15,
      category: "Dental clinics",
      targetCount: 5,
      mode: "Quick",
      runtime: "codex",
      searchArea: {
        id: "relation:276892",
        displayName: "Kraków, Polska",
        latitude: 50.0614,
        longitude: 19.9366,
        countryCode: "PL",
      },
    }

    const first = await Effect.runPromise(
      startProspectingRun(input, "request-1").pipe(Effect.provide(layer)),
    )
    const second = await Effect.runPromise(
      startProspectingRun(input, "request-1").pipe(Effect.provide(layer)),
    )
    const defaults = await Effect.runPromise(getSearchBriefDefaults.pipe(Effect.provide(layer)))

    expect(second.id).toBe(first.id)
    expect(Option.getOrUndefined(defaults)).toEqual({
      radiusKm: 15,
      category: "Dental clinics",
      targetCount: 5,
      mode: "Quick",
    })
    expect(JSON.stringify(Option.getOrUndefined(defaults))).not.toContain("Kraków")
  })
})
