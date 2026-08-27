import { CircleGaugeIcon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/icon"
import { PageHeader } from "@/components/page-layout"
import { PageScroller } from "@/components/page-scroller"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { NewRunButton } from "@/features/prospecting-runs/client"
import { ReviewWorkspace } from "@/features/review-queue/presentation/review-workspace"
import { getReviewQueueSummaries } from "@/features/review-queue/server/review-queue-read-model"

export function ReviewQueuePage() {
  const queue = getReviewQueueSummaries()
  return (
    <PageScroller>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Candidates"
          description="Review evidence, record decisions, and preserve machine history."
        />
        {queue.truncated ? (
          <Alert>
            <AlertTitle>Candidate List Limited</AlertTitle>
            <AlertDescription>
              Showing the highest-scoring {queue.limit} candidates. Lower-scoring candidates are
              held back from this view.
            </AlertDescription>
          </Alert>
        ) : null}
        {queue.candidates.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon icon={CircleGaugeIcon} />
              </EmptyMedia>
              <EmptyTitle>Nothing To Review Yet</EmptyTitle>
              <EmptyDescription>
                Complete a prospecting run and its qualified candidates arrive here, with the
                evidence behind every score.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <NewRunButton />
            </EmptyContent>
          </Empty>
        ) : (
          <ReviewWorkspace candidates={queue.candidates} />
        )}
      </div>
    </PageScroller>
  )
}
