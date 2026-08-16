import { Effect, Layer } from "effect"
import { describe, expect, it } from "vitest"

import type { DependencyReadiness } from "@/features/local-application"
import { confirmSearchBrief } from "@/features/prospecting-runs/application/confirm-search-brief"
import { SearchAreaGeocoder } from "@/features/prospecting-runs/application/search-brief-preflight"
import type { SearchArea } from "@/features/prospecting-runs/domain/search-brief"
import { makeInMemoryProspectingRunRepository } from "@/features/prospecting-runs/infrastructure/in-memory-prospecting-run-repository"
import type { RuntimeReadiness } from "@/features/runtime-settings"

const berlin: SearchArea = {
  id: "relation:62422",
  displayName: "Berlin, Deutschland",
  latitude: 52.517,
  longitude: 13.3889,
  countryCode: "DE",
}
const readyDependencies: readonly DependencyReadiness[] = [
  { id: "sqlite", label: "SQLite", status: "Ready", detail: "Ready" },
  { id: "brave-search", label: "Brave", status: "Ready", detail: "Ready" },
  { id: "playwright", label: "Playwright", status: "Ready", detail: "Ready" },
  { id: "disk", label: "Disk", status: "Ready", detail: "Ready" },
]
const runtime: RuntimeReadiness = {
  runtimeId: "codex",
  label: "Codex",
  status: "Ready",
  detail: "Ready",
}
const draft = {
  location: "Berlin, Germany",
  category: "Independent climbing gyms",
  targetCount: 50,
  mode: "Thorough",
  runtime: "codex",
}

function program(
  repository: ReturnType<typeof makeInMemoryProspectingRunRepository>,
  searchAreas: readonly SearchArea[],
  dependencies = readyDependencies,
) {
  return confirmSearchBrief(draft, berlin.id, "request-1", dependencies, runtime).pipe(
    Effect.provide(
      Layer.succeed(SearchAreaGeocoder, { search: () => Effect.succeed(searchAreas) }),
    ),
    Effect.provide(repository.layer),
  )
}

describe("Search Brief confirmation", () => {
  it("creates exactly one pending run for a confirmed non-Polish custom-category brief", async () => {
    const repository = makeInMemoryProspectingRunRepository()
    const first = await Effect.runPromise(program(repository, [berlin]))
    const second = await Effect.runPromise(program(repository, [berlin]))

    expect(first.id).toBe(second.id)
    expect(first.searchBrief).toMatchObject({ targetCount: 50, category: draft.category })
    expect(repository.runs).toHaveLength(1)
  })

  it("creates no run when an ambiguous result was not selected", async () => {
    const repository = makeInMemoryProspectingRunRepository()
    const result = await Effect.runPromiseExit(
      confirmSearchBrief(draft, "", "request-2", readyDependencies, runtime).pipe(
        Effect.provide(
          Layer.succeed(SearchAreaGeocoder, {
            search: () => Effect.succeed([berlin, { ...berlin, id: "way:2" }]),
          }),
        ),
        Effect.provide(repository.layer),
      ),
    )

    expect(result._tag).toBe("Failure")
    expect(repository.runs).toHaveLength(0)
  })

  it("creates no run after failed preflight", async () => {
    const repository = makeInMemoryProspectingRunRepository()
    const dependencies = readyDependencies.map((dependency) =>
      dependency.id === "sqlite" ? { ...dependency, status: "Unreachable" as const } : dependency,
    )
    const result = await Effect.runPromiseExit(program(repository, [berlin], dependencies))

    expect(result._tag).toBe("Failure")
    expect(repository.runs).toHaveLength(0)
  })
})
