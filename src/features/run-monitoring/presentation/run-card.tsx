import { ArrowRight01Icon, MapPinIcon } from "@hugeicons/core-free-icons"
import Link from "next/link"
import { Icon } from "@/components/icon"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { RunRow } from "@/features/run-monitoring/presentation/run-presentation"

/**
 * One run at a glance. Built from the same parts as the rest of the workspace — a heading, muted
 * supporting text and rules for structure — rather than nested card chrome, so the two views of the
 * runs list read as the same system.
 */
export function RunCard({ run }: { run: RunRow }) {
  return (
    <Link
      href={`/runs/${run.id}`}
      className="@container group flex h-full flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="truncate font-heading text-base font-semibold tracking-tight">
            {run.category}
          </p>
          {/* The truncation lives on the text itself; a flex row cannot truncate its children. */}
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
            <Icon icon={MapPinIcon} className="size-3.5 shrink-0" />
            <span className="truncate">{run.location}</span>
          </p>
        </div>
        <Badge variant={run.status.variant} title={run.status.detail} className="shrink-0">
          {run.status.label}
        </Badge>
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            <span className="font-medium text-foreground">{run.qualified}</span> / {run.targetCount}{" "}
            Qualified
          </span>
          <span className="tabular-nums">{run.completion}%</span>
        </div>
        <Progress value={run.completion} />
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs @sm:grid-cols-3">
        {[
          { label: "Discovered", value: run.discovered },
          { label: "Assessed", value: run.assessed },
          { label: "Stage", value: run.stage },
        ].map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="truncate text-muted-foreground">{item.label}</dt>
            <dd className="truncate font-medium tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
        <span className="truncate">
          {run.mode} · Updated {run.updatedLabel}
        </span>
        <Icon
          icon={ArrowRight01Icon}
          className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
        />
      </div>
    </Link>
  )
}
