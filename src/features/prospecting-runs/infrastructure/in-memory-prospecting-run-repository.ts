import { Effect, Layer, Option } from "effect"

import {
  type PendingProspectingRun,
  ProspectingRunRepositoryTag,
} from "@/features/prospecting-runs/application/prospecting-run"

export const makeInMemoryProspectingRunRepository = () => {
  const runs: PendingProspectingRun[] = []
  return {
    runs,
    layer: Layer.succeed(ProspectingRunRepositoryTag, {
      createPending: (searchBrief, requestId) =>
        Effect.sync(() => {
          const existing = runs.find((run) => run.requestId === requestId)
          if (existing) return existing
          const run: PendingProspectingRun = {
            id: crypto.randomUUID(),
            requestId,
            searchBrief,
            state: "Pending",
            createdAt: new Date(),
          }
          runs.push(run)
          return run
        }),
      getDefaults: Effect.sync(() => {
        const latest = runs.at(-1)?.searchBrief
        return latest
          ? Option.some({
              radiusKm: latest.radiusKm,
              category: latest.category,
              targetCount: latest.targetCount,
              mode: latest.mode,
            })
          : Option.none()
      }),
    }),
  }
}
