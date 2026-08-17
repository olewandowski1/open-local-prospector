import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
    <Card>
      <CardHeader>
        <CardTitle>Storage Locations</CardTitle>
        <CardDescription>
          Override these with <code className="font-mono">PROSPECTOR_DATABASE_PATH</code> and{" "}
          <code className="font-mono">PROSPECTOR_ARTIFACTS_PATH</code> before starting the
          application.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3">
          {locations.map((location) => (
            <div key={location.label} className="grid gap-1">
              <dt className="text-sm font-medium">{location.label}</dt>
              <dd className="truncate rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
                {location.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
