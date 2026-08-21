import { Effect } from "effect"
import { connection } from "next/server"
import { SectionHeader } from "@/components/page-layout"
import { Separator } from "@/components/ui/separator"
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
    <div className="@container mx-auto flex w-full max-w-5xl flex-col gap-8">
      <section aria-labelledby="local-readiness-heading" className="flex flex-col gap-4">
        <SectionHeader
          title={<span id="local-readiness-heading">Local Readiness</span>}
          description="On-device dependencies used for local storage and website inspection."
        />
        <LocalReadinessSection readiness={readiness} />
      </section>
      <Separator />
      <StorageLocationsSection config={config} />
    </div>
  )
}
