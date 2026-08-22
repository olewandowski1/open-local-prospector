import type { RunProgressCounts } from "@/features/run-monitoring/domain/run-progress"
import {
  runAdjustments,
  runFunnel,
} from "@/features/run-monitoring/presentation/run-detail-presentation"
import { RunFact } from "@/features/run-monitoring/presentation/run-fact"

export function RunProgressFunnel({ progress }: { progress: RunProgressCounts }) {
  // The funnel in the order the run walks it, then the counts that adjusted it along the way.
  const counts = [...runFunnel(progress), ...runAdjustments(progress)]

  return (
    <>
      {counts.map((item) => (
        <RunFact key={item.key} label={item.label}>
          <span className="font-medium tabular-nums">{item.value}</span>
        </RunFact>
      ))}
    </>
  )
}
