import type { LucideIcon } from "lucide-react"
import { Check, CircleHelp, Database, FolderOpen, X } from "lucide-react"

import type { DependencyReadiness } from "@/features/local-application/readiness/get-local-readiness"

const dependencyIcons: Record<DependencyReadiness["id"], LucideIcon> = {
  sqlite: Database,
  playwright: CircleHelp,
  disk: FolderOpen,
}

const checklistLabels: Record<DependencyReadiness["id"], string> = {
  sqlite: "SQLite Database",
  playwright: "Playwright Chromium",
  disk: "Storage Capacity",
}

export function LocalReadinessSection({
  readiness,
}: {
  readiness: readonly DependencyReadiness[]
}) {
  return (
    <ul aria-label="Local Readiness Checklist" className="overflow-hidden rounded-xl border">
      {readiness.map((item) => {
        const Icon = dependencyIcons[item.id]
        const ready = item.status === "Ready"
        const StatusIcon = ready ? Check : X

        return (
          <li key={item.id} className="flex items-start gap-3 border-b p-4 last:border-b-0">
            <div className="flex size-9 shrink-0 items-center justify-center text-muted-foreground">
              <Icon aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-heading font-medium">{checklistLabels[item.id]}</h3>
                <span
                  title={ready ? undefined : item.status}
                  className={
                    ready
                      ? "inline-flex items-center gap-1 text-sm text-success"
                      : "inline-flex items-center gap-1 text-sm text-destructive"
                  }
                >
                  <StatusIcon className="size-3.5" aria-hidden="true" />
                  {ready ? "Ready" : "Not Ready"}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
