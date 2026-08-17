import { FileSearch, Plus } from "lucide-react"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import type { RunSummary } from "@/features/run-monitoring/domain/run-progress"
import { toRunRow } from "@/features/run-monitoring/presentation/run-presentation"
import { RunsWorkspace } from "@/features/run-monitoring/presentation/runs-workspace"

export function RunsPage({ runs, now }: { runs: readonly RunSummary[]; now: Date }) {
  const rows = runs.map((run) => toRunRow(run, now))

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Prospecting Runs</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Persisted work and checkpointed progress. Every run keeps its own evidence and history.
          </p>
        </div>
        <Link href="/runs/new" className={buttonVariants()}>
          <Plus data-icon="inline-start" aria-hidden="true" />
          New Run
        </Link>
      </div>

      {rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileSearch />
            </EmptyMedia>
            <EmptyTitle>No Runs Yet</EmptyTitle>
            <EmptyDescription>Create and confirm a Search Brief to begin.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <RunsWorkspace runs={rows} />
      )}
    </main>
  )
}
