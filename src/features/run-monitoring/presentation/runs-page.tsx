import { MapPin, Plus } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { RunSummary } from "@/features/run-monitoring/domain/run-progress"

export function RunsPage({ runs }: { runs: readonly RunSummary[] }) {
  return (
    <main className="flex-1 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Prospecting Runs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Persisted work and checkpointed progress.
          </p>
        </div>
        <Link href="/runs/new" className={buttonVariants()}>
          <Plus aria-hidden="true" /> New run
        </Link>
      </div>
      {runs.length === 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>No runs yet</CardTitle>
            <CardDescription>Create and confirm a Search Brief to begin.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {runs.map((run) => (
            <Link
              key={run.id}
              href={`/runs/${run.id}`}
              className="rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-colors hover:bg-muted/30">
                <CardHeader>
                  <CardTitle>{run.searchBrief.category}</CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <MapPin aria-hidden="true" /> {run.searchBrief.searchArea.displayName}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    {run.currentStage ?? "Waiting"} · {run.progress.qualifiedCandidates} qualified
                  </div>
                  <Badge variant={run.state === "Completed" ? "secondary" : "outline"}>
                    {run.completionState ?? run.state}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
