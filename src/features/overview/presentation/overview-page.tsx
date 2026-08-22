import {
  ActivityIcon,
  Add01Icon,
  ChartDownIcon,
  ChartUpIcon,
  CircleGaugeIcon,
  ClipboardCheckIcon,
  MinusSignIcon,
} from "@hugeicons/core-free-icons"
import Link from "next/link"
import type { ReactNode } from "react"
import { Icon, type IconSvg } from "@/components/icon"

import { PageHeader, SectionHeader } from "@/components/page-layout"
import { PageScroller } from "@/components/page-scroller"
import { buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  calculateOverviewMetrics,
  type OverviewCandidateSummary,
  type OverviewRunSnapshot,
  type OverviewTrend,
} from "@/features/overview/domain/overview-metrics"
import { RecentCandidatesGrid } from "@/features/overview/presentation/recent-candidates-grid"
import type { RecentCandidate } from "@/features/review-queue"

/** An arrow is only shown for a measured week-over-week change. */
const trendIcons: Partial<Record<OverviewTrend, IconSvg>> = {
  up: ChartUpIcon,
  down: ChartDownIcon,
  flat: MinusSignIcon,
}

/** Standing facts get a subject icon instead, so every tile reads the same without faking a trend. */
const standingIcons: Record<string, IconSvg> = {
  "awaiting-review": ClipboardCheckIcon,
  "active-runs": ActivityIcon,
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
    <PageScroller>
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Overview"
          description="Persisted prospecting activity from this workspace, and the runtime that steers the next run."
          actions={
            <Link href="/runs/new" className={buttonVariants()}>
              <Icon icon={Add01Icon} data-icon="inline-start" />
              New Run
            </Link>
          }
        />

        {/* Rules between the figures carry the structure a card used to, without boxing each one in. */}
        <section
          aria-label="Prospecting Summary"
          className="grid gap-x-8 gap-y-6 border-y py-5 sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-border"
        >
          {metrics.map((item) => {
            const trendIcon = trendIcons[item.trend] ?? standingIcons[item.id] ?? MinusSignIcon
            return (
              <div key={item.id} className="flex flex-col gap-1 xl:not-first:pl-8">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="font-heading text-3xl leading-none font-semibold tabular-nums">
                  {item.value}
                </p>
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Icon icon={trendIcon} className="mt-0.5 size-3.5 shrink-0" />
                  <span className="text-pretty font-medium text-foreground">{item.note}</span>
                </p>
              </div>
            )
          })}
        </section>

        <section aria-label="Run Steering">{steeringPanel}</section>

        <section aria-label="Recent Candidates" className="flex flex-col gap-3">
          <SectionHeader
            title="Recent Candidates"
            description="The most recently scored qualified businesses. Suppressed businesses never appear."
          />
          <div>
            {recentCandidates.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon icon={CircleGaugeIcon} />
                  </EmptyMedia>
                  <EmptyTitle>No Qualified Candidates Yet</EmptyTitle>
                  <EmptyDescription>
                    Candidates appear here once a prospecting run has scored them. Nothing is
                    estimated and no sample data is ever shown.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Link href="/runs/new" className={buttonVariants()}>
                    <Icon icon={Add01Icon} data-icon="inline-start" />
                    New Run
                  </Link>
                </EmptyContent>
              </Empty>
            ) : (
              <RecentCandidatesGrid candidates={recentCandidates} />
            )}
          </div>
        </section>
      </div>
    </PageScroller>
  )
}
