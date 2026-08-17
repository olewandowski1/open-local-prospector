import { ChevronRight } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { RunProgressCounts } from "@/features/run-monitoring/domain/run-progress"
import {
  runAdjustments,
  runFunnel,
} from "@/features/run-monitoring/presentation/run-detail-presentation"

export function RunProgressFunnel({ progress }: { progress: RunProgressCounts }) {
  const funnel = runFunnel(progress)
  const adjustments = runAdjustments(progress)

  return (
    <Card>
      <CardHeader>
        {/* These panels are document sections, so their titles carry heading semantics. */}
        <CardTitle role="heading" aria-level={2}>
          Run Progress
        </CardTitle>
        <CardDescription>
          Application-generated counts from committed SQLite checkpoints.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <ol className="flex flex-wrap items-stretch gap-1">
          {funnel.map((step, index) => (
            <li key={step.key} className="flex flex-1 items-center gap-1">
              <div className="min-w-0 flex-1 rounded-lg border px-3 py-2">
                <p className="truncate text-xs text-muted-foreground">{step.label}</p>
                <p className="font-heading text-xl font-medium tabular-nums">{step.value}</p>
              </div>
              {index < funnel.length - 1 ? (
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground/60"
                />
              ) : null}
            </li>
          ))}
        </ol>

        <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t pt-4 text-xs">
          {adjustments.map((item) => (
            <div key={item.key} className="flex items-baseline gap-1.5">
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd className="font-medium tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
