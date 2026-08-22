"use client"

import { useEffect, useState } from "react"
import { DataTablePagination, DEFAULT_PAGE_SIZE } from "@/components/data-table-pagination"
import { SectionHeader } from "@/components/page-layout"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
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
  businessStatusTone,
  formatBusinessScore,
} from "@/features/run-monitoring/presentation/run-detail-presentation"
import { humanizeStage } from "@/features/run-monitoring/presentation/run-presentation"
import { cn } from "@/lib/utils"

// Columns drop away in ascending order of usefulness, so the table never scrolls sideways.
const columnClass = {
  status: "hidden @sm:table-cell",
  score: "whitespace-nowrap",
  stage: "hidden @2xl:table-cell",
  retries: "hidden @4xl:table-cell",
  issue: "max-w-40 @2xl:max-w-72",
} as const

const statusToneClass = {
  muted: "text-muted-foreground",
  destructive: "text-destructive",
  warning: "text-warning",
  success: "text-success",
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
  action?: React.ReactNode
}) {
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)

  const pageCount = Math.max(1, Math.ceil(businesses.length / pageSize))

  // A polling run keeps adding businesses, so the page must stay inside the range that still exists.
  useEffect(() => {
    setPageIndex((current) => Math.min(current, pageCount - 1))
  }, [pageCount])

  const page = businesses.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize)

  return (
    <section aria-labelledby="business-progress-heading" className="flex flex-col gap-4">
      <SectionHeader
        title={<span id="business-progress-heading">Per-Business Progress</span>}
        description={`A business reaches the Review Queue at ${REVIEW_QUEUE_THRESHOLD} points. Select one to narrow the Technical Run Log to its events.`}
        actions={
          <>
            {selectedBusinessId ? (
              <Button variant="ghost" size="sm" onClick={() => onSelect(undefined)}>
                Clear Selection
              </Button>
            ) : null}
            {action}
          </>
        }
      />
      {businesses.length === 0 ? (
        <Empty className="min-h-48 border py-10">
          <EmptyHeader>
            <EmptyTitle>No Business Progress Yet</EmptyTitle>
            <EmptyDescription>
              Per-business rows appear after the first discovery checkpoint is committed.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead className={columnClass.stage}>Stage</TableHead>
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
                      {business.sourceEventCount}{" "}
                      {business.sourceEventCount === 1 ? "Event" : "Events"}
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
                    <span
                      className={cn(
                        "font-medium",
                        statusToneClass[businessStatusTone(business.status)],
                      )}
                    >
                      {humanizeStage(business.status)}
                    </span>
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
