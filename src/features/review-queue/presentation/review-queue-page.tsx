import { Add01Icon, CircleGaugeIcon } from "@hugeicons/core-free-icons"
import Link from "next/link"
import { Icon } from "@/components/icon"
import { PageHeader } from "@/components/page-layout"
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
import { ReviewWorkspace } from "@/features/review-queue/presentation/review-workspace"
import { getReviewQueueSummaries } from "@/features/review-queue/server/review-queue-read-model"

export function ReviewQueuePage() {
  const candidates = getReviewQueueSummaries()
  return (
    <PageScroller className="flex flex-col gap-6">
      <PageHeader
        title="Review Queue"
        description="Review evidence, record decisions, and preserve machine history."
      />
      {candidates.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon icon={CircleGaugeIcon} />
            </EmptyMedia>
            <EmptyTitle>Nothing To Review Yet</EmptyTitle>
            <EmptyDescription>
              Complete a prospecting run and its qualified candidates arrive here, with the evidence
              behind every score.
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
        <ReviewWorkspace candidates={candidates} />
      )}
    </PageScroller>
  )
}
