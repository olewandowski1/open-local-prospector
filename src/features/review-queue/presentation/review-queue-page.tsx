import { CircleGauge, Plus } from "lucide-react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ReviewWorkspace } from "@/features/review-queue/presentation/review-workspace"
import { getReviewQueue } from "@/features/review-queue/server/review-queue-read-model"

export function ReviewQueuePage() {
  const candidates = getReviewQueue()
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Review Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review evidence, record decisions, and preserve machine history.
          </p>
        </div>
        <Link href="/runs/new" className={buttonVariants()}>
          <Plus data-icon="inline-start" />
          New Run
        </Link>
      </div>
      {candidates.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleGauge />
            </EmptyMedia>
            <EmptyTitle>No Qualified Candidates Yet</EmptyTitle>
            <EmptyDescription>
              Complete a prospecting run to populate this persisted queue.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ReviewWorkspace candidates={candidates} />
      )}
    </main>
  )
}
