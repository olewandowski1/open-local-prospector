import { Effect, Layer } from "effect"

import {
  type PendingProspectingRun,
  ProspectingRunRepositoryTag,
} from "@/features/prospecting-runs/application/prospecting-run"

export const makeInMemoryProspectingRunRepository = () => {
  const runs: PendingProspectingRun[] = []
  return {
    runs,
    layer: Layer.succeed(ProspectingRunRepositoryTag, {
      createPending: (searchBrief) =>
        Effect.sync(() => {
          const run: PendingProspectingRun = {
            id: crypto.randomUUID(),
            searchBrief,
            state: "Pending",
          }
          runs.push(run)
          return run
        }),
    }),
  }
}
