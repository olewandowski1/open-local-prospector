"use client"

import { ArrowLeft, Ban, CirclePause, CirclePlay, MapPin, RotateCcw } from "lucide-react"
import Link from "next/link"

import { PageHeader } from "@/components/page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import type { RunControl } from "@/features/run-monitoring/application/run-repositories"
import type { RunDetail } from "@/features/run-monitoring/domain/run-progress"
import { runControlAvailability } from "@/features/run-monitoring/presentation/run-detail-presentation"
import {
  formatUpdatedAt,
  humanizeStage,
  runStatusPresentation,
} from "@/features/run-monitoring/presentation/run-presentation"
import { RunProgressFunnel } from "@/features/run-monitoring/presentation/run-progress-funnel"
import { RuntimeProviderIcon } from "@/features/runtime-settings/client"
import { RunDeleteDialog } from "@/features/workspace-administration/client"

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
  const status = runStatusPresentation(run.state, run.completionState)

  return (
    <div className="flex shrink-0 flex-col gap-3">
      <PageHeader
        eyebrow={
          <Link
            href="/runs"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            All Runs
          </Link>
        }
        title={run.searchBrief.category}
        description={
          <span className="flex min-w-0 items-center gap-1.5">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{run.searchBrief.searchArea.displayName}</span>
          </span>
        }
        actions={
          <>
            <Button
              variant="warning"
              size="sm"
              onClick={() => onControl("Pause")}
              disabled={!canPause || busy}
            >
              <CirclePause data-icon="inline-start" aria-hidden="true" /> Pause
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={() => onControl("Resume")}
              disabled={!canResume || busy}
            >
              <CirclePlay data-icon="inline-start" aria-hidden="true" /> Resume
            </Button>
            {/* Cancelling a run cannot be undone, so it is styled as the destructive act it is. */}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onControl("Cancel")}
              disabled={!canCancel || busy}
            >
              <Ban data-icon="inline-start" aria-hidden="true" /> Cancel
            </Button>
            <Button variant="info" size="sm" onClick={onRefresh} disabled={refreshing}>
              <RotateCcw data-icon="inline-start" aria-hidden="true" /> Refresh
            </Button>
            {["Completed", "Cancelled"].includes(run.state) ? (
              <RunDeleteDialog
                runId={run.id}
                runLabel={`${run.searchBrief.category} in ${run.searchBrief.searchArea.displayName}`}
              />
            ) : null}
          </>
        }
      />

      <div className="grid shrink-0 gap-3 border-y py-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
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

          {/* The run state is the one thing worth a badge; the rest are facts, not statuses. */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            <Badge variant={status.variant} title={status.detail}>
              {status.label}
            </Badge>
            <span>{humanizeStage(run.currentStage)}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <RuntimeProviderIcon runtimeId={run.searchBrief.runtime} />
              {configuration
                ? `${configuration.model} · ${configuration.reasoningEffort}`
                : "Model Not Recorded"}
            </span>
            {run.requestedControl !== "None" ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{run.requestedControl} Requested</span>
              </>
            ) : null}
          </div>
        </div>

        <Separator />

        <RunProgressFunnel progress={run.progress} />
      </div>
    </div>
  )
}
