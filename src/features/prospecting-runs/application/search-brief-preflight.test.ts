import { Effect, Layer } from "effect"
import { describe, expect, it } from "vitest"

import type { DependencyReadiness } from "@/features/local-application"
import {
  defaultPoland,
  prepareSearchBrief,
  SearchAreaGeocoder,
} from "@/features/prospecting-runs/application/search-brief-preflight"
import type { SearchArea } from "@/features/prospecting-runs/domain/search-brief"
import type { RuntimeReadiness } from "@/features/runtime-settings"

const krakow: SearchArea = {
  id: "relation:276892",
  displayName: "Kraków, Polska",
  latitude: 50.0614,
  longitude: 19.9366,
  countryCode: "PL",
}
const readyDependencies: readonly DependencyReadiness[] = [
  { id: "sqlite", label: "SQLite", status: "Ready", detail: "Ready" },
  { id: "playwright", label: "Playwright", status: "Ready", detail: "Ready" },
  { id: "disk", label: "Disk", status: "Ready", detail: "Ready" },
]
const readyRuntime: RuntimeReadiness = {
  runtimeId: "codex",
  label: "Codex",
  status: "Ready",
  detail: "Ready",
}
const draft = {
  location: "Kraków",
  category: "Dental clinics",
  targetCount: 5,
  mode: "Quick",
  runtime: "codex",
  runtimeConfiguration: { model: "gpt-5.6-sol", reasoningEffort: "medium" },
}

function run(searchAreas: readonly SearchArea[], dependencies = readyDependencies) {
  return Effect.runPromise(
    prepareSearchBrief(draft, dependencies, readyRuntime).pipe(
      Effect.provide(
        Layer.succeed(SearchAreaGeocoder, { search: () => Effect.succeed(searchAreas) }),
      ),
    ),
  )
}

describe("Search Brief preflight", () => {
  it("defaults an unqualified location to Poland", () => {
    expect(defaultPoland("Kraków")).toBe("Kraków, Poland")
    expect(defaultPoland("Berlin, Germany")).toBe("Berlin, Germany")
  })

  it("returns every ambiguous Search Area for explicit selection", async () => {
    const result = await run([krakow, { ...krakow, id: "way:1", displayName: "Kraków County" }])
    expect(result.searchAreas).toHaveLength(2)
    expect(result.ready).toBe(true)
  })

  it("cannot be ready when a dependency fails", async () => {
    const dependencies = readyDependencies.map((dependency) =>
      dependency.id === "playwright" ? { ...dependency, status: "Missing" as const } : dependency,
    )
    const result = await run([krakow], dependencies)
    expect(result.ready).toBe(false)
  })

  it("does not claim a precise subscription cost", async () => {
    const result = await run([krakow])
    expect(result.estimate.note).toContain("not a provider subscription cost quote")
  })
})
