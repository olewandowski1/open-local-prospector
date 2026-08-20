"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, LoaderCircle } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { RunControl } from "@/features/run-monitoring/application/run-repositories"
import type { RunDetail } from "@/features/run-monitoring/domain/run-progress"
import { RunBusinessesTable } from "@/features/run-monitoring/presentation/run-businesses-table"
import { RunDetailHeader } from "@/features/run-monitoring/presentation/run-detail-header"
import { isRunTerminal } from "@/features/run-monitoring/presentation/run-detail-presentation"
import { TechnicalLogSheet } from "@/features/run-monitoring/presentation/technical-log-panel"

export function RunDetailPage({ runId }: { runId: string }) {
  const queryClient = useQueryClient()
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>()
  const query = useQuery({
    queryKey: ["run", runId],
    queryFn: () => fetchRun(runId),
    refetchInterval: (state) => (isRunTerminal(state.state.data) ? false : 1_500),
  })
  const control = useMutation({
    mutationFn: (value: RunControl) => controlRun(runId, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["run", runId] }),
  })

  if (query.isPending) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <LoaderCircle className="animate-spin" aria-label="Loading run" />
      </main>
    )
  }
  if (query.isError) {
    return (
      <main className="flex-1 p-4 sm:p-6">
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Run Unavailable</AlertTitle>
          <AlertDescription>
            The persisted run could not be loaded. <Link href="/runs">Return to Runs</Link>.
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  const run = query.data
  const selectedBusiness = run.businesses.find((business) => business.id === selectedBusinessId)

  return (
    // Bounded to the viewport so the controls never leave the screen while a run is producing events.
    // The business list takes whatever height is left and scrolls inside itself.
    <main className="flex h-[calc(100svh-var(--shell-header))] flex-col gap-4 overflow-hidden p-4 sm:p-6">
      <RunDetailHeader
        run={run}
        now={new Date()}
        busy={control.isPending}
        refreshing={query.isFetching}
        onControl={(value) => control.mutate(value)}
        onRefresh={() => query.refetch()}
      />

      {control.isError ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Control Not Accepted</AlertTitle>
          <AlertDescription>The persisted state changed; refresh and try again.</AlertDescription>
        </Alert>
      ) : null}

      <RunBusinessesTable
        businesses={run.businesses}
        selectedBusinessId={selectedBusinessId}
        onSelect={setSelectedBusinessId}
        action={
          <TechnicalLogSheet
            events={run.technicalLog}
            businessId={selectedBusinessId}
            businessLabel={selectedBusiness?.name ?? selectedBusiness?.id}
            onClearBusiness={() => setSelectedBusinessId(undefined)}
          />
        }
      />
    </main>
  )
}

async function fetchRun(runId: string): Promise<RunDetail> {
  const response = await fetch(`/api/runs/${encodeURIComponent(runId)}`)
  if (!response.ok) throw new Error("run unavailable")
  return (await response.json()) as RunDetail
}

async function controlRun(runId: string, control: RunControl): Promise<void> {
  const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/control`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ control }),
  })
  if (!response.ok) throw new Error("control rejected")
}
