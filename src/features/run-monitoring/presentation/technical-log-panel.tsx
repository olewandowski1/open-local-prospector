"use client"

import { useVirtualizer } from "@tanstack/react-virtual"
import { ExternalLink, ScrollText } from "lucide-react"
import { useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { TechnicalRunEvent } from "@/features/run-monitoring/domain/run-progress"
import {
  eventKindCounts,
  eventSourceLabel,
  filterTechnicalLog,
  safeHttpUrl,
} from "@/features/run-monitoring/presentation/run-detail-presentation"
import { humanizeStage } from "@/features/run-monitoring/presentation/run-presentation"
import { cn } from "@/lib/utils"

/** Rows only need the time; the full stamp stays available as the title. */
const timeFormat = new Intl.DateTimeFormat("en-GB", { timeStyle: "medium" })
const timestampFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "medium",
})

/** Kinds that record something going wrong, so the eye is drawn to them first. */
const troubleKinds = ["InspectionBlock", "Failure", "Retry", "Error"]

export function TechnicalLogSheet({
  events,
  limit,
  truncated,
  businessId,
  businessLabel,
  onClearBusiness,
}: {
  events: readonly TechnicalRunEvent[]
  /** How many entries the run detail request returns at most. */
  limit: number
  /** True when the run holds older entries than these. */
  truncated: boolean
  businessId?: string
  businessLabel?: string
  onClearBusiness: () => void
}) {
  const [kind, setKind] = useState<string>()

  // Counted after the business filter so the chip totals always reconcile with the list below.
  const inScope = useMemo(() => filterTechnicalLog(events, { businessId }), [events, businessId])
  const kinds = useMemo(() => eventKindCounts(inScope), [inScope])
  const filtered = useMemo(() => filterTechnicalLog(inScope, { kind }), [inScope, kind])

  const selectKind = (next?: string) => setKind(next)

  // Every event of a kind carries the same sentence, so it is stated once here rather than on each of
  // the hundreds of rows below.
  const kindMessage = kind ? filtered[0]?.message : undefined

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm">
            <ScrollText data-icon="inline-start" aria-hidden="true" />
            Technical Log ({events.length})
          </Button>
        }
      />
      <SheetContent
        side="right"
        className="w-full gap-0 bg-background p-0 data-[side=right]:sm:max-w-2xl"
      >
        <SheetHeader className="p-4">
          <SheetTitle>Technical Run Log</SheetTitle>
          <SheetDescription>
            Source and tool events, retries, transitions, and errors. This is not hidden AI
            reasoning.
            {truncated ? ` Showing the most recent ${limit} entries of this run.` : null}
          </SheetDescription>
        </SheetHeader>

        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 px-4">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No technical events yet.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <LogFilterButton active={!kind} onClick={() => selectKind(undefined)}>
                  All <span className="tabular-nums opacity-70">{inScope.length}</span>
                </LogFilterButton>
                {kinds.map((item) => (
                  <LogFilterButton
                    key={item.kind}
                    active={kind === item.kind}
                    onClick={() => selectKind(item.kind)}
                  >
                    {humanizeStage(item.kind)}{" "}
                    <span className="tabular-nums opacity-70">{item.count}</span>
                  </LogFilterButton>
                ))}
                {businessId ? (
                  <Button variant="ghost" size="sm" className="h-7" onClick={onClearBusiness}>
                    Clear {businessLabel ? `“${businessLabel}”` : "Business"} Filter
                  </Button>
                ) : null}
              </div>

              {filtered.length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">
                  No events match the current filter.
                </p>
              ) : (
                <div className="flex min-h-0 flex-col gap-2">
                  {kindMessage ? (
                    <p className="text-sm text-muted-foreground">{kindMessage}</p>
                  ) : null}
                  <EventRows events={filtered} />
                </div>
              )}
            </>
          )}
        </div>

        <Separator />
        <SheetFooter className="flex-row items-center justify-between gap-3 p-3 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {filtered.length} {filtered.length === 1 ? "Event" : "Events"}
          </span>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/**
 * The run as a sequence of machine events, one line each. Every event of a kind repeats the same
 * sentence, so a row carries only what actually differs — when it happened, which source it came from
 * and where the result lives. Only the rows in view are rendered, so a run that checkpointed thousands
 * costs the same as one that checkpointed ten.
 */
function EventRows({ events }: { events: readonly TechnicalRunEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Derived rather than passed: when every row shares one kind, the label repeats the filter above it.
  // A caller cannot then disagree with the data about whether the column is worth its width.
  const showKind = useMemo(() => new Set(events.map((event) => event.kind)).size > 1, [events])
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 29,
    getItemKey: (index) => events[index].id,
    overscan: 12,
  })

  return (
    <div ref={scrollRef} className="app-scrollbar min-h-0 overflow-y-auto">
      <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const event = events[item.index]
          const url = safeHttpUrl(event.resultUrl)
          const stamp = timestampFormat.format(new Date(event.createdAt))
          return (
            <div
              key={event.id}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute inset-x-0 top-0"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <div className="flex items-baseline gap-2 border-b py-1.5 text-xs">
                <time
                  dateTime={event.createdAt}
                  title={stamp}
                  className="shrink-0 text-muted-foreground tabular-nums"
                >
                  {timeFormat.format(new Date(event.createdAt))}
                </time>
                {showKind ? (
                  <span
                    className={cn(
                      "shrink-0 font-medium",
                      troubleKinds.includes(event.kind) && "text-destructive",
                    )}
                  >
                    {humanizeStage(event.kind)}
                  </span>
                ) : null}
                <span
                  className="min-w-0 flex-1 truncate text-muted-foreground"
                  title={event.sourceIdentifier ?? undefined}
                >
                  {event.sourceIdentifier
                    ? eventSourceLabel(event.sourceIdentifier)
                    : event.message}
                </span>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Result URL"
                    title={url}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ExternalLink aria-hidden="true" className="size-3.5" />
                  </a>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LogFilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      size="xs"
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
