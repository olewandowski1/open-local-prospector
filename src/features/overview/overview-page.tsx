import { CircleCheck, Clock3, Download, Globe2, MapPin, Play, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import {
  overviewCandidates,
  overviewRuns,
  overviewStats,
} from "@/features/overview/overview-fixtures"

export function OverviewPage() {
  return (
    <main className="flex-1 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge variant="secondary" className="mb-3">
            Interface preview · sample data
          </Badge>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Good morning, Oliver</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review promising local businesses or start a focused scan.
          </p>
        </div>
        <Button disabled>
          <Plus data-icon="inline-start" aria-hidden="true" />
          New prospecting run
        </Button>
      </div>

      <section
        aria-label="Prospecting summary"
        className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {overviewStats.map((stat) => (
          <Card key={stat.label} size="sm">
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{stat.value}</CardTitle>
            </CardHeader>
            <CardFooter className="text-xs text-muted-foreground">{stat.note}</CardFooter>
          </Card>
        ))}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Recent runs</CardTitle>
            <CardDescription>Discovery and analysis jobs from this workspace.</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" disabled>
                View all
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-4">
              {overviewRuns.map((run) => (
                <li
                  key={`${run.location}-${run.category}`}
                  className="flex items-center gap-3 border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    {run.state.kind === "completion" ? (
                      <CircleCheck aria-hidden="true" />
                    ) : (
                      <Play aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{run.category}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin aria-hidden="true" />
                      {run.location} · {run.found} found · {run.candidates} candidates
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={run.state.kind === "completion" ? "secondary" : "outline"}>
                      {run.state.label}
                    </Badge>
                    <p className="mt-1 text-[10px] text-muted-foreground">{run.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Top candidates</CardTitle>
            <CardDescription>Highest deterministic opportunity scores.</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" disabled>
                Review
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-4">
              {overviewCandidates.map((candidate) => (
                <li key={candidate.name}>
                  <Progress value={candidate.score} className="gap-2">
                    <div className="flex w-full items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <ProgressLabel className="truncate text-sm font-medium text-foreground">
                          {candidate.name}
                        </ProgressLabel>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {candidate.location} · {candidate.reason}
                        </p>
                      </div>
                      <ProgressValue className="w-10 text-right font-semibold" />
                    </div>
                  </Progress>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="border-t">
            <Button variant="outline" className="w-full" disabled>
              <Download data-icon="inline-start" aria-hidden="true" />
              Export shortlist
            </Button>
          </CardFooter>
        </Card>
      </section>

      <Card className="mt-4 bg-muted/30">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-background shadow-sm">
            <Globe2 aria-hidden="true" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Ready for another market?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose a Polish location, category, depth, and AI runtime. Public sources only.
            </p>
          </div>
          <Button variant="outline" disabled>
            <Clock3 data-icon="inline-start" aria-hidden="true" />
            Start quick scan
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
