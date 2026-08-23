import { DatabaseBackupIcon, Delete02Icon, FileEmpty02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { SectionHeader } from "@/components/page-layout"
import { Separator } from "@/components/ui/separator"
import type {
  SuppressionRecord,
  WorkspaceInventoryPresentation,
} from "@/features/workspace-administration/domain/workspace-presentation"
import { SuppressionList } from "@/features/workspace-administration/presentation/suppression-list"

export function DataStoragePage({
  inventory,
  suppressions,
}: {
  inventory: WorkspaceInventoryPresentation
  suppressions: readonly SuppressionRecord[]
}) {
  const figures = [
    { label: "Prospecting Runs", value: inventory.runs },
    { label: "Discovered Businesses", value: inventory.discoveredBusinesses },
    { label: "Qualified Candidates", value: inventory.qualifiedCandidates },
    { label: "Decisions Recorded", value: inventory.decisionsRecorded },
    { label: "Technical Events", value: inventory.technicalEvents },
    { label: "Suppressions", value: inventory.suppressions },
  ]

  return (
    <div className="@container mx-auto flex w-full max-w-5xl flex-col gap-8">
      <section aria-labelledby="workspace-storage-heading" className="flex flex-col gap-4">
        <SectionHeader
          title={<span id="workspace-storage-heading">Workspace Storage</span>}
          description="Live figures from the SQLite database and assessment artifacts on this device."
        />

        <dl className="grid gap-x-6 gap-y-4 @sm:grid-cols-2 @lg:grid-cols-3">
          {figures.map((figure) => (
            <div key={figure.label} className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-muted-foreground">{figure.label}</dt>
              <dd className="font-heading font-semibold tabular-nums">{figure.value}</dd>
            </div>
          ))}
        </dl>

        <dl className="overflow-hidden rounded-xl border">
          <StorageLocation
            icon={DatabaseBackupIcon}
            label="SQLite Database"
            size={inventory.databaseSize}
            path={inventory.databasePath}
          />
          <StorageLocation
            icon={FileEmpty02Icon}
            label="Assessment Artifacts"
            size={`${inventory.artifactCount} Files · ${inventory.artifactSize}`}
            path={inventory.artifactsPath}
          />
        </dl>
      </section>

      <Separator />
      <SuppressionList suppressions={suppressions} emptyIcon={Delete02Icon} />
    </div>
  )
}

function StorageLocation({
  icon,
  label,
  size,
  path,
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"]
  label: string
  size: string
  path: string
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 border-b p-4 last:border-b-0">
      <HugeiconsIcon
        icon={icon}
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-muted-foreground"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <dt className="font-medium">{label}</dt>
          <span className="text-sm tabular-nums text-muted-foreground">{size}</span>
        </div>
        <dd className="truncate font-mono text-xs text-muted-foreground" title={path}>
          {path}
        </dd>
      </div>
    </div>
  )
}
