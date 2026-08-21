import { FileSearch, Plus } from "lucide-react"
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
import type { RunSummary } from "@/features/run-monitoring/domain/run-progress"
import { toRunRow } from "@/features/run-monitoring/presentation/run-presentation"
import { RunsWorkspace } from "@/features/run-monitoring/presentation/runs-workspace"

export function RunsPage({ runs, now }: { runs: readonly RunSummary[]; now: Date }) {
  const rows = runs.map((run) => toRunRow(run, now))

  return (
    <main className="app-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Prospecting Runs"
          description="Persisted work and checkpointed progress. Every run keeps its own evidence and history."
        />

        {rows.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileSearch />
              </EmptyMedia>
              <EmptyTitle>No Runs Yet</EmptyTitle>
              <EmptyDescription>
                A run discovers local businesses, inspects their websites and scores what it finds.
                Confirm a Search Brief to start the first one.
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
          <RunsWorkspace runs={rows} />
        )}
      </div>
    </main>
  )
}
