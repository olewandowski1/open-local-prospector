"use client"

import { useEffect, useState } from "react"
import { DataTablePagination, DEFAULT_PAGE_SIZE } from "@/components/data-table-pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { REVIEW_QUEUE_THRESHOLD } from "@/features/review-queue/client"
import type { BusinessProgress } from "@/features/run-monitoring/domain/run-progress"
import {
  businessStatusVariant,
  formatBusinessScore,
} from "@/features/run-monitoring/presentation/run-detail-presentation"
import { humanizeStage } from "@/features/run-monitoring/presentation/run-presentation"
import { cn } from "@/lib/utils"

/**
 * Column priority as the viewport narrows. The business and its status always stay; the rest drop away
 * so the table never has to scroll sideways.
 */
const columnClass = {
  // Only at the very narrowest does the status step aside; the badge is wide and the row already
  // shows a failure through the Issue column.
  status: "hidden @sm:table-cell",
  score: "whitespace-nowrap",
  stage: "hidden @2xl:table-cell",
  retries: "hidden @4xl:table-cell",
  // The Issue column always stays: a failure reason is the whole point of looking at this table.
  issue: "max-w-40 @2xl:max-w-72",
} as const

export function RunBusinessesTable({
  businesses,
  selectedBusinessId,
  onSelect,
  action,
}: {
  businesses: readonly BusinessProgress[]
  selectedBusinessId?: string
  onSelect: (businessId?: string) => void
  /** Sits with the heading, because what it opens is scoped by the selection made here. */
  action?: React.ReactNode
}) {
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)

  const pageCount = Math.max(1, Math.ceil(businesses.length / pageSize))

  // A polling run keeps adding businesses, so the page has to stay inside the range that still exists.
  useEffect(() => {
    setPageIndex((current) => Math.min(current, pageCount - 1))
  }, [pageCount])

  const page = businesses.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize)

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {/* This is a document section, so its title carries heading semantics. */}
          <h2 className="font-heading text-base font-semibold tracking-tight">
            Per-Business Progress
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            A business reaches the Review Queue at {REVIEW_QUEUE_THRESHOLD} points. Select one to
            narrow the Technical Run Log to its events.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedBusinessId ? (
            <Button variant="ghost" size="sm" onClick={() => onSelect(undefined)}>
              Clear Selection
            </Button>
          ) : null}
          {action}
        </div>
      </div>
      {/* Bounded so a run with many businesses scrolls here rather than lengthening the page. */}
      <div className="min-h-0 flex-1">
        <ScrollArea className="h-full">
          {businesses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No per-business work has been checkpointed yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead className={columnClass.stage}>Stage</TableHead>
                  {/* Score sits beside Status, so the number and the verdict it produced read together. */}
                  <TableHead className={columnClass.score}>Score</TableHead>
                  <TableHead className={columnClass.status}>Status</TableHead>
                  <TableHead className={columnClass.retries}>Retries</TableHead>
                  <TableHead className={columnClass.issue}>Issue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.map((business) => {
                  const selected = business.id === selectedBusinessId
                  return (
                    <TableRow
                      key={business.id}
                      onClick={() => onSelect(selected ? undefined : business.id)}
                      aria-selected={selected}
                      className={cn("cursor-pointer", selected && "bg-muted/60")}
                    >
                      <TableCell>
                        <span className="block max-w-40 truncate font-medium @xl:max-w-80">
                          {business.name ?? business.id}
                        </span>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          {business.sourceEvents.length}{" "}
                          {business.sourceEvents.length === 1 ? "Event" : "Events"}
                        </span>
                      </TableCell>
                      <TableCell className={cn("text-muted-foreground", columnClass.stage)}>
                        {humanizeStage(business.currentStage)}
                      </TableCell>
                      {/* The pass mark is prose above the table, not a denominator: scores run past it. */}
                      <TableCell className={columnClass.score}>
                        {business.score === undefined ? (
                          <span className="text-muted-foreground">&mdash;</span>
                        ) : (
                          <span
                            title={`${formatBusinessScore(business.score)} points; ${REVIEW_QUEUE_THRESHOLD} needed to reach the Review Queue`}
                            className={cn(
                              "font-medium tabular-nums",
                              business.qualified ? "text-success" : "text-muted-foreground",
                            )}
                          >
                            {formatBusinessScore(business.score)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={columnClass.status}>
                        <Badge variant={businessStatusVariant(business.status)}>
                          {humanizeStage(business.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn("tabular-nums", columnClass.retries)}>
                        {business.retryCount}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-xs whitespace-normal text-muted-foreground",
                          columnClass.issue,
                        )}
                      >
                        {business.failureReason ?? "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </div>

      {businesses.length > 0 ? (
        <DataTablePagination
          pageIndex={pageIndex}
          pageSize={pageSize}
          pageCount={pageCount}
          rowsOnPage={page.length}
          total={businesses.length}
          canPrevious={pageIndex > 0}
          canNext={pageIndex < pageCount - 1}
          onPrevious={() => setPageIndex((current) => Math.max(0, current - 1))}
          onNext={() => setPageIndex((current) => Math.min(pageCount - 1, current + 1))}
          onPageChange={setPageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPageIndex(0)
          }}
        />
      ) : null}
    </section>
  )
}
