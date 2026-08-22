import { Add01Icon, FileSearchIcon } from "@hugeicons/core-free-icons"
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
import type { RunSummary } from "@/features/run-monitoring/domain/run-progress"
import { toRunRow } from "@/features/run-monitoring/presentation/run-presentation"
import { RunsWorkspace } from "@/features/run-monitoring/presentation/runs-workspace"

export function RunsPage({ runs, now }: { runs: readonly RunSummary[]; now: Date }) {
  const rows = runs.map((run) => toRunRow(run, now))

  return (
    <PageScroller>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Prospecting Runs"
          description="Persisted work and checkpointed progress. Every run keeps its own evidence and history."
        />

        {rows.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon icon={FileSearchIcon} />
              </EmptyMedia>
              <EmptyTitle>No Runs Yet</EmptyTitle>
              <EmptyDescription>
                A run discovers local businesses, inspects their websites and scores what it finds.
                Confirm a Search Brief to start the first one.
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
          <RunsWorkspace runs={rows} />
        )}
      </div>
    </PageScroller>
  )
}
