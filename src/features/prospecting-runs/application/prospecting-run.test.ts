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
})
