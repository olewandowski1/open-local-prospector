"use client"

import { ExternalLink } from "lucide-react"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { TechnicalRunEvent } from "@/features/run-monitoring/domain/run-progress"
import {
  eventKindCounts,
  filterTechnicalLog,
  safeHttpUrl,
} from "@/features/run-monitoring/presentation/run-detail-presentation"
import { humanizeStage } from "@/features/run-monitoring/presentation/run-presentation"
import { cn } from "@/lib/utils"

/** A run can checkpoint hundreds of events, so the log opens bounded and says what it is holding back. */
const PAGE_SIZE = 40

const timestampFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "medium",
})

export function TechnicalLogPanel({
  events,
  businessId,
  businessLabel,
  onClearBusiness,
}: {
  events: readonly TechnicalRunEvent[]
  businessId?: string
  businessLabel?: string
  onClearBusiness: () => void
}) {
  const [kind, setKind] = useState<string>()
  const [visible, setVisible] = useState(PAGE_SIZE)

  // Counted after the business filter so the chip totals always reconcile with the list below.
  const inScope = useMemo(() => filterTechnicalLog(events, { businessId }), [events, businessId])
  const kinds = useMemo(() => eventKindCounts(inScope), [inScope])
  const filtered = useMemo(() => filterTechnicalLog(inScope, { kind }), [inScope, kind])
  const shown = filtered.slice(0, visible)

  const selectKind = (next?: string) => {
    setKind(next)
    setVisible(PAGE_SIZE)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Technical Run Log
        </CardTitle>
        <CardDescription>
          Source and tool events, retries, transitions, and errors. This is not hidden AI reasoning.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No technical events yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterChip active={!kind} onClick={() => selectKind(undefined)}>
                All <span className="tabular-nums opacity-70">{inScope.length}</span>
              </FilterChip>
              {kinds.map((item) => (
                <FilterChip
                  key={item.kind}
                  active={kind === item.kind}
                  onClick={() => selectKind(item.kind)}
                >
                  {humanizeStage(item.kind)}{" "}
                  <span className="tabular-nums opacity-70">{item.count}</span>
                </FilterChip>
              ))}
              {businessId ? (
                <Button variant="ghost" size="sm" className="h-7" onClick={onClearBusiness}>
                  Clear {businessLabel ? `“${businessLabel}”` : "Business"} Filter
                </Button>
              ) : null}
            </div>

            <ol className="max-h-[28rem] overflow-y-auto pr-1">
              {shown.map((event) => {
                const url = safeHttpUrl(event.resultUrl)
                return (
                  <li key={event.id} className="border-b py-3 text-sm first:pt-0 last:border-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{humanizeStage(event.kind)}</Badge>
                      <time
                        dateTime={event.createdAt}
                        className="text-xs text-muted-foreground tabular-nums"
                      >
                        {timestampFormat.format(new Date(event.createdAt))}
                      </time>
                    </div>
                    <p className="mt-1.5 text-pretty">{event.message}</p>
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
                        Result URL <ExternalLink aria-hidden="true" className="size-3" />
                      </a>
                    ) : null}
                  </li>
                )
              })}
              {filtered.length === 0 ? (
                <li className="py-3 text-sm text-muted-foreground">
                  No events match the current filter.
                </li>
              ) : null}
            </ol>
          </>
        )}
      </CardContent>

      {filtered.length > 0 ? (
        <CardFooter className="justify-between gap-3 text-xs text-muted-foreground">
          {/* Stated explicitly so a bounded list never reads as a complete one. */}
          <span className="tabular-nums">
            Showing {shown.length} of {filtered.length} Events
          </span>
          {shown.length < filtered.length ? (
            <Button variant="outline" size="sm" onClick={() => setVisible(visible + PAGE_SIZE)}>
              Show More
            </Button>
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "border-foreground/30 bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}
