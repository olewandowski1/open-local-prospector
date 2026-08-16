import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import { startProspectingRun } from "@/features/prospecting-runs/application/prospecting-run"
import { makeInMemoryProspectingRunRepository } from "@/features/prospecting-runs/infrastructure/in-memory-prospecting-run-repository"

describe("Prospecting Run", () => {
  it("creates one pending run through the repository seam", async () => {
    const repository = makeInMemoryProspectingRunRepository()
    const result = await Effect.runPromise(
      startProspectingRun({
        location: "Kraków",
        category: "Dental clinics",
        targetCount: 10,
        mode: "Quick",
        runtime: "codex",
        searchArea: {
          id: "relation:276892",
          displayName: "Kraków, Polska",
          latitude: 50.0614,
          longitude: 19.9366,
          countryCode: "PL",
        },
      }).pipe(Effect.provide(repository.layer)),
    )
    expect(result.state).toBe("Pending")
    expect(repository.runs).toHaveLength(1)
  })

  it("does not write an invalid Search Brief", async () => {
    const repository = makeInMemoryProspectingRunRepository()
    const result = await Effect.runPromiseExit(
      startProspectingRun({ targetCount: 2 }).pipe(Effect.provide(repository.layer)),
    )
    expect(result._tag).toBe("Failure")
    expect(repository.runs).toHaveLength(0)
  })

  it("creates at most one run for an idempotency request", async () => {
    const repository = makeInMemoryProspectingRunRepository()
    const input = {
      location: "Berlin, Germany",
      category: "Restaurants",
      targetCount: 50,
      mode: "Thorough",
      runtime: "codex",
      searchArea: {
        id: "relation:62422",
        displayName: "Berlin, Deutschland",
        latitude: 52.517,
        longitude: 13.3889,
        countryCode: "DE",
      },
    }
    const program = startProspectingRun(input, "same-request").pipe(
      Effect.provide(repository.layer),
    )

    const [first, second] = await Effect.runPromise(Effect.all([program, program]))
    expect(first.id).toBe(second.id)
    expect(repository.runs).toHaveLength(1)
  })
})
