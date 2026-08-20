import { ChevronRight } from "lucide-react"

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
    <section aria-labelledby="run-progress-heading" className="grid gap-2">
      {/* This is a document section, so its title carries heading semantics. */}
      <h2 id="run-progress-heading" className="text-sm font-medium">
        Run Progress
      </h2>

      <ol className="flex flex-wrap items-stretch gap-1">
        {funnel.map((step, index) => (
          <li key={step.key} className="flex flex-1 items-center gap-1">
            <div className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5">
              <p className="truncate text-xs text-muted-foreground">{step.label}</p>
              <p className="font-heading text-lg font-medium tabular-nums">{step.value}</p>
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

      {/* One strip sharing the funnel's box language. The 1px gaps over a border-coloured background
          give clean separators however the cells wrap. */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
        {adjustments.map((item) => (
          <div key={item.key} className="min-w-0 bg-background px-2.5 py-1.5">
            <dt className="truncate text-xs text-muted-foreground">{item.label}</dt>
            <dd className="text-sm font-medium tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
