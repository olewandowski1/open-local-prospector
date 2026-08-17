import {
  Activity,
  CircleGauge,
  ClipboardCheck,
  type LucideIcon,
  Minus,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  calculateOverviewMetrics,
  type OverviewCandidateSummary,
  type OverviewRunSnapshot,
  type OverviewTrend,
} from "@/features/overview/domain/overview-metrics"
import { RecentCandidatesGrid } from "@/features/overview/presentation/recent-candidates-grid"
import type { RecentCandidate } from "@/features/review-queue"

/** An arrow is only shown for a measured week-over-week change. */
const trendIcons: Partial<Record<OverviewTrend, LucideIcon>> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
}

/** Standing facts get a subject icon instead, so every tile reads the same without faking a trend. */
const standingIcons: Record<string, LucideIcon> = {
  "awaiting-review": ClipboardCheck,
  "active-runs": Activity,
}

export function OverviewPage({
  runs,
  candidateSummary,
  recentCandidates,
  steeringPanel,
  now,
}: {
  runs: readonly OverviewRunSnapshot[]
  candidateSummary: OverviewCandidateSummary
  recentCandidates: readonly RecentCandidate[]
  /** Rendered inside the steering region; the route streams it in once runtime readiness resolves. */
  steeringPanel: ReactNode
  /** Reference point for the week-over-week comparisons. */
  now: Date
}) {
  const metrics = calculateOverviewMetrics(runs, candidateSummary, now)

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Overview</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Persisted prospecting activity from this workspace, and the runtime that steers the next
            run.
          </p>
        </div>
        <Link href="/runs/new" className={buttonVariants()}>
          <Plus data-icon="inline-start" aria-hidden="true" />
          New Run
        </Link>
      </div>

      <section
        aria-label="Prospecting Summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {metrics.map((item) => {
          const TrendIcon = trendIcons[item.trend] ?? standingIcons[item.id] ?? Minus
          return (
            <Card key={item.id} size="sm">
              <CardHeader>
                <CardDescription>{item.label}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{item.value}</CardTitle>
              </CardHeader>
              <CardFooter className="items-start gap-1.5 text-xs text-muted-foreground">
                <TrendIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                <span className="text-pretty">
                  <span className="font-medium text-foreground">{item.note}</span>
                  {item.detail ? ` · ${item.detail}` : null}
                </span>
              </CardFooter>
            </Card>
          )
        })}
      </section>

      <section aria-label="Run Steering">{steeringPanel}</section>

      <section aria-label="Recent Candidates">
        <Card>
          <CardHeader>
            <CardTitle>Recent Candidates</CardTitle>
            <CardDescription>
              The most recently scored qualified businesses. Suppressed businesses never appear.
            </CardDescription>
            <CardAction>
              <Link href="/review" className={buttonVariants({ size: "sm" })}>
                Review Queue
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {recentCandidates.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CircleGauge />
                  </EmptyMedia>
                  <EmptyTitle>No Qualified Candidates Yet</EmptyTitle>
                  <EmptyDescription>
                    Complete a prospecting run to populate this persisted grid.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <RecentCandidatesGrid candidates={recentCandidates} />
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
