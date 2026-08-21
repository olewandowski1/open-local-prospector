import { CircleGauge, Plus } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/page-layout"
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
    <main className="flex h-[calc(100svh-var(--shell-header))] flex-col gap-6 overflow-hidden p-4 sm:p-6">
      <PageHeader
        title="Review Queue"
        description="Review evidence, record decisions, and preserve machine history."
      />
      {candidates.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleGauge />
            </EmptyMedia>
            <EmptyTitle>Nothing To Review Yet</EmptyTitle>
            <EmptyDescription>
              Complete a prospecting run and its qualified candidates arrive here, with the evidence
              behind every score.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link href="/runs/new" className={buttonVariants()}>
              <Plus data-icon="inline-start" aria-hidden="true" />
              New Run
            </Link>
          </EmptyContent>
        </Empty>
      ) : (
        <ReviewWorkspace candidates={candidates} />
      )}
    </main>
  )
}
