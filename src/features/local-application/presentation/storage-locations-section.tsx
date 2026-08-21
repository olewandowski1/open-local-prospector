import { SectionHeader } from "@/components/page-layout"
import type { LocalApplicationConfig } from "@/features/local-application/configuration"

/**
 * Where the Local Application keeps its data. Paths are non-secret configuration; no credential,
 * token, or provider cache is ever surfaced here.
 */
export function StorageLocationsSection({ config }: { config: LocalApplicationConfig }) {
  const locations = [
    { label: "SQLite Database", value: config.databasePath },
    { label: "Assessment Artifacts", value: config.artifactsPath },
    { label: "Environment File", value: config.environmentPath },
  ]

  return (
    <section aria-labelledby="storage-locations-heading" className="flex flex-col gap-4">
      <SectionHeader
        title={<span id="storage-locations-heading">Storage Locations</span>}
        description={
          <>
            Override these with <code className="font-mono">PROSPECTOR_DATABASE_PATH</code> and{" "}
            <code className="font-mono">PROSPECTOR_ARTIFACTS_PATH</code> before starting the
            application.
          </>
        }
      />
      <dl className="overflow-hidden rounded-xl border">
        {locations.map((location) => (
          <div key={location.label} className="grid gap-1 border-b p-4 last:border-b-0">
            <dt className="text-sm font-medium">{location.label}</dt>
            <dd className="truncate font-mono text-xs text-muted-foreground" title={location.value}>
              {location.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
