import { ChevronRight, MapPin } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { RunRow } from "@/features/run-monitoring/presentation/run-presentation"

export function RunCard({ run }: { run: RunRow }) {
  return (
    <Link
      href={`/runs/${run.id}`}
      className="group rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full transition-colors group-hover:border-foreground/20">
        <CardHeader>
          <CardTitle className="truncate">{run.category}</CardTitle>
          <CardDescription className="flex items-center gap-1 truncate">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            {run.location}
          </CardDescription>
          <CardAction>
            <Badge variant={run.settled ? "secondary" : "outline"}>{run.status}</Badge>
          </CardAction>
        </CardHeader>

        <CardContent className="grid gap-4">
          <div className="grid gap-1.5">
            <div className="flex items-baseline justify-between text-xs text-muted-foreground">
              <span>
                <span className="font-medium text-foreground tabular-nums">{run.qualified}</span> of{" "}
                <span className="tabular-nums">{run.targetCount}</span> Qualified
              </span>
              <span className="tabular-nums">{run.completion}%</span>
            </div>
            <Progress value={run.completion} />
          </div>

          <dl className="grid grid-cols-3 gap-2 text-xs">
            {[
              { label: "Discovered", value: run.discovered },
              { label: "Assessed", value: run.assessed },
              { label: "Stage", value: run.stage },
            ].map((item) => (
              <div key={item.label} className="min-w-0">
                <dt className="truncate text-muted-foreground">{item.label}</dt>
                <dd className="truncate font-medium tabular-nums">{item.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>

        <CardFooter className="justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">
            {run.mode} · Updated {run.updatedLabel}
          </span>
          <ChevronRight
            aria-hidden="true"
            className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
          />
        </CardFooter>
      </Card>
    </Link>
  )
}
