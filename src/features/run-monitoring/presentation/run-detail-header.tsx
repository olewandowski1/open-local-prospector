"use client"

import { ArrowLeft, Ban, CirclePause, CirclePlay, MapPin, RotateCcw } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { RunControl } from "@/features/run-monitoring/application/run-repositories"
import type { RunDetail } from "@/features/run-monitoring/domain/run-progress"
import { runControlAvailability } from "@/features/run-monitoring/presentation/run-detail-presentation"
import {
  formatUpdatedAt,
  humanizeStage,
} from "@/features/run-monitoring/presentation/run-presentation"
import { RuntimeProviderIcon } from "@/features/runtime-settings/client"

export function RunDetailHeader({
  run,
  now,
  busy,
  refreshing,
  onControl,
  onRefresh,
}: {
  run: RunDetail
  now: Date
  busy: boolean
  refreshing: boolean
  onControl: (control: RunControl) => void
  onRefresh: () => void
}) {
  const { canPause, canResume, canCancel } = runControlAvailability(run)
  const target = run.searchBrief.targetCount
  const qualified = run.progress.qualifiedCandidates
  const completion = target <= 0 ? 0 : Math.min(100, Math.round((qualified / target) * 100))
  const configuration = run.searchBrief.runtimeConfiguration

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/runs"
        className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        All Runs
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {run.searchBrief.category}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            {run.searchBrief.searchArea.displayName}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onControl("Pause")}
            disabled={!canPause || busy}
          >
            <CirclePause aria-hidden="true" /> Pause
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onControl("Resume")}
            disabled={!canResume || busy}
          >
            <CirclePlay aria-hidden="true" /> Resume
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onControl("Cancel")}
            disabled={!canCancel || busy}
          >
            <Ban aria-hidden="true" /> Cancel
          </Button>
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing}>
            <RotateCcw aria-hidden="true" /> Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
              <span>
                <span className="font-medium text-foreground tabular-nums">{qualified}</span> of{" "}
                <span className="tabular-nums">{target}</span> Qualified
              </span>
              <span className="tabular-nums">{completion}%</span>
            </div>
            <Progress value={completion} />
            <p className="text-xs text-muted-foreground">
              Updated {formatUpdatedAt(run.updatedAt, now)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{run.completionState ?? run.state}</Badge>
            <Badge variant="outline">{humanizeStage(run.currentStage)}</Badge>
            <Badge variant="outline" className="gap-1.5">
              <RuntimeProviderIcon runtimeId={run.searchBrief.runtime} />
              {configuration
                ? `${configuration.model} · ${configuration.reasoningEffort}`
                : "Model Not Recorded"}
            </Badge>
            {run.requestedControl !== "None" ? (
              <Badge variant="outline">{run.requestedControl} Requested</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
