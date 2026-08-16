"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  Ban,
  CirclePause,
  CirclePlay,
  ExternalLink,
  LoaderCircle,
  RotateCcw,
} from "lucide-react"
import Link from "next/link"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { RunControl } from "@/features/run-monitoring/application/run-repositories"
import type { RunDetail } from "@/features/run-monitoring/domain/run-progress"

const progressLabels: ReadonlyArray<readonly [keyof RunDetail["progress"], string]> = [
  ["queries", "Queries"],
  ["discoveries", "Discoveries"],
  ["duplicates", "Duplicates"],
  ["exclusions", "Exclusions"],
  ["websites", "Websites"],
  ["assessments", "Assessments"],
  ["qualifiedCandidates", "Qualified candidates"],
  ["blockedInspections", "Blocked inspections"],
  ["targetRemaining", "Target remaining"],
]

export function RunDetailPage({ runId }: { runId: string }) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ["run", runId],
    queryFn: () => fetchRun(runId),
    refetchInterval: (state) => (isTerminal(state.state.data) ? false : 1_500),
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
      <main className="flex-1 p-6">
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Run unavailable</AlertTitle>
          <AlertDescription>
            The persisted run could not be loaded. <Link href="/runs">Return to Runs</Link>.
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  const run = query.data
  const canPause = ["Pending", "Running"].includes(run.state) && run.requestedControl === "None"
  const canResume = run.state === "Paused" || run.completionState === "Runtime Unavailable"
  const canCancel = !["Completed", "Cancelled"].includes(run.state)

  return (
    <main className="flex-1 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/runs" className="text-xs text-muted-foreground hover:text-foreground">
              ← Runs
            </Link>
            <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight">
              {run.searchBrief.category}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {run.searchBrief.searchArea.displayName} · target {run.searchBrief.targetCount}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{run.completionState ?? run.state}</Badge>
              <Badge variant="outline">Stage: {run.currentStage ?? "Waiting"}</Badge>
              {run.requestedControl !== "None" ? (
                <Badge variant="outline">{run.requestedControl} requested</Badge>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => control.mutate("Pause")}
              disabled={!canPause || control.isPending}
            >
              <CirclePause aria-hidden="true" /> Pause
            </Button>
            <Button
              variant="outline"
              onClick={() => control.mutate("Resume")}
              disabled={!canResume || control.isPending}
            >
              <CirclePlay aria-hidden="true" /> Resume
            </Button>
            <Button
              variant="destructive"
              onClick={() => control.mutate("Cancel")}
              disabled={!canCancel || control.isPending}
            >
              <Ban aria-hidden="true" /> Cancel
            </Button>
          </div>
        </div>

        {control.isError ? (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Control not accepted</AlertTitle>
            <AlertDescription>The persisted state changed; refresh and try again.</AlertDescription>
          </Alert>
        ) : null}

        <section aria-labelledby="run-progress-title" className="mt-6">
          <h2 id="run-progress-title" className="font-heading text-lg font-semibold">
            Run Progress
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Application-generated counts from committed SQLite checkpoints.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {progressLabels.map(([key, label]) => (
              <Card key={key} size="sm">
                <CardHeader>
                  <CardDescription>{label}</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{run.progress[key]}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="business-progress-title" className="mt-6">
          <h2 id="business-progress-title" className="font-heading text-lg font-semibold">
            Per-business progress
          </h2>
          <div className="mt-3 grid gap-3">
            {run.businesses.length === 0 ? (
              <Card>
                <CardContent className="text-sm text-muted-foreground">
                  No per-business work has been checkpointed yet.
                </CardContent>
              </Card>
            ) : (
              run.businesses.map((business) => (
                <Card key={business.id} size="sm">
                  <CardHeader>
                    <CardTitle>{business.id}</CardTitle>
                    <CardDescription>
                      {business.currentStage} · {business.status} · {business.retryCount} retries
                    </CardDescription>
                  </CardHeader>
                  {business.failureReason || business.sourceEvents.length ? (
                    <CardContent className="grid gap-2 text-sm">
                      {business.failureReason ? (
                        <p className="text-destructive">{business.failureReason}</p>
                      ) : null}
                      {business.sourceEvents.map((event) => (
                        <p key={event.id} className="text-muted-foreground">
                          {event.message}
                        </p>
                      ))}
                    </CardContent>
                  ) : null}
                </Card>
              ))
            )}
          </div>
        </section>

        <section aria-labelledby="technical-log-title" className="mt-6">
          <h2 id="technical-log-title" className="font-heading text-lg font-semibold">
            Technical Run Log
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Source and tool events, retries, transitions, and errors. This is not hidden AI
            reasoning.
          </p>
          <Card className="mt-3">
            <CardContent>
              {run.technicalLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">No technical events yet.</p>
              ) : (
                <ol className="grid gap-3">
                  {run.technicalLog.map((event) => {
                    const url = safeHttpUrl(event.resultUrl)
                    return (
                      <li key={event.id} className="border-b pb-3 text-sm last:border-0 last:pb-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{event.kind}</Badge>
                          <time className="text-xs text-muted-foreground">
                            {new Date(event.createdAt).toLocaleString()}
                          </time>
                        </div>
                        <p className="mt-1">{event.message}</p>
                        {event.sourceIdentifier ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Source: {event.sourceIdentifier}
                          </p>
                        ) : null}
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs underline underline-offset-4"
                          >
                            Result URL <ExternalLink aria-hidden="true" />
                          </a>
                        ) : null}
                      </li>
                    )
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </section>

        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RotateCcw aria-hidden="true" /> Refresh
          </Button>
        </div>
      </div>
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

function isTerminal(run?: RunDetail): boolean {
  return run ? ["Completed", "Cancelled"].includes(run.state) : false
}

function safeHttpUrl(value?: string): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined
  } catch {
    return undefined
  }
}
