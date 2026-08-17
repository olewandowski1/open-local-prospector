import { Effect } from "effect"
import { connection } from "next/server"

import { loadLocalApplicationConfig } from "@/features/local-application/configuration"
import { ReadinessProbeLive } from "@/features/local-application/infrastructure/readiness/readiness-probe-live"
import { LocalReadinessSection } from "@/features/local-application/presentation/local-readiness-section"
import { StorageLocationsSection } from "@/features/local-application/presentation/storage-locations-section"
import { getLocalReadiness } from "@/features/local-application/readiness/get-local-readiness"

export default async function GeneralSettingsRoute() {
  await connection()
  const config = loadLocalApplicationConfig()
  const readiness = await Effect.runPromise(
    getLocalReadiness(config).pipe(Effect.provide(ReadinessProbeLive)),
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-lg font-semibold">Local Readiness</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          On-device dependencies used for local storage and website inspection.
        </p>
      </div>
      <LocalReadinessSection readiness={readiness} />
      <StorageLocationsSection config={config} />
    </div>
  )
}
