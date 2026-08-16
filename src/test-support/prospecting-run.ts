import { Effect } from "effect"

import { startProspectingRun } from "@/features/prospecting-runs/application/prospecting-run"
import { sqliteProspectingRunRepositoryLive } from "@/features/prospecting-runs/infrastructure/sqlite-prospecting-run-repository"

export function createTestProspectingRun(databasePath: string, requestId: string) {
  return Effect.runPromise(
    startProspectingRun(
      {
        location: "Kraków",
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
      },
      requestId,
    ).pipe(Effect.provide(sqliteProspectingRunRepositoryLive(databasePath))),
  )
}
