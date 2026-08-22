import { Separator } from "@/components/ui/separator"
import type { RunProgressCounts } from "@/features/run-monitoring/domain/run-progress"
import {
  runAdjustments,
  runFunnel,
} from "@/features/run-monitoring/presentation/run-detail-presentation"

export function RunProgressFunnel({ progress }: { progress: RunProgressCounts }) {
  const funnel = runFunnel(progress)
  const adjustments = runAdjustments(progress)

  return (
    <div className="@container">
      {/* Container queries, not viewport: the sidebar makes this narrower at 768px than at 640px. */}
      <ol className="grid grid-cols-3 gap-x-4 gap-y-3 p-4 @2xl:grid-cols-5">
        {funnel.map((step) => (
          <li key={step.key} className="min-w-0 @2xl:not-first:border-l @2xl:not-first:pl-4">
            <p className="truncate text-xs text-muted-foreground">{step.label}</p>
            <p className="font-heading text-xl font-semibold tabular-nums">{step.value}</p>
          </li>
        ))}
      </ol>

      <Separator />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 @xl:grid-cols-4">
        {adjustments.map((item) => (
          <div
            key={item.key}
            className="flex min-w-0 items-baseline justify-between gap-2 @xl:not-first:border-l @xl:not-first:pl-4"
          >
            <dt className="truncate text-xs text-muted-foreground">{item.label}</dt>
            <dd className="text-sm font-medium tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
