import { FileSearchIcon } from "@hugeicons/core-free-icons"
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
import type { BoundedRunList } from "@/features/run-monitoring/domain/run-progress"
import { toRunRow } from "@/features/run-monitoring/presentation/run-presentation"
import { RunsWorkspace } from "@/features/run-monitoring/presentation/runs-workspace"

export function RunsPage({ runList, now }: { runList: BoundedRunList; now: Date }) {
  const rows = runList.runs.map((run) => toRunRow(run, now))

  return (
    <PageScroller>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Prospecting Runs"
          description="Persisted work and checkpointed progress. Every run keeps its own evidence and history."
        />

        {runList.truncated ? (
          <Alert>
            <AlertTitle>Run List Limited</AlertTitle>
            <AlertDescription>
              Showing the {runList.limit} most recent runs. Older runs are held back from this view.
            </AlertDescription>
          </Alert>
        ) : null}

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
              <NewRunButton />
            </EmptyContent>
          </Empty>
        ) : (
          <RunsWorkspace runs={rows} />
        )}
      </div>
    </PageScroller>
  )
}
