import { Separator } from "@/components/ui/separator"
import type { RunProgressCounts } from "@/features/run-monitoring/domain/run-progress"
import {
  runAdjustments,
  runFunnel,
} from "@/features/run-monitoring/presentation/run-detail-presentation"

/**
 * Stage-by-stage counts from committed SQLite checkpoints. Rendered without a surface of its own so it
 * can sit alongside the completion bar it belongs with, rather than repeating progress in a second card.
 */
export function RunProgressFunnel({ progress }: { progress: RunProgressCounts }) {
  const funnel = runFunnel(progress)
  const adjustments = runAdjustments(progress)

  return (
    <div>
      <ol className="grid grid-cols-3 gap-x-4 gap-y-3 p-4 sm:grid-cols-5 sm:divide-x sm:divide-border">
        {funnel.map((step) => (
          <li key={step.key} className="min-w-0 sm:not-first:pl-4">
            <p className="truncate text-xs text-muted-foreground">{step.label}</p>
            <p className="font-heading text-xl font-semibold tabular-nums">{step.value}</p>
          </li>
        ))}
      </ol>

      <Separator />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 sm:grid-cols-4 sm:divide-x sm:divide-border">
        {adjustments.map((item) => (
          <div
            key={item.key}
            className="flex min-w-0 items-baseline justify-between gap-2 sm:not-first:pl-4"
          >
            <dt className="truncate text-xs text-muted-foreground">{item.label}</dt>
            <dd className="text-sm font-medium tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
