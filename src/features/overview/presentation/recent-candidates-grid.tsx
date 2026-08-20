"use client"

import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown, SquareArrowOutUpRight, Waypoints } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"

import { DataTablePagination, DEFAULT_PAGE_SIZE } from "@/components/data-table-pagination"
import { IconLink } from "@/components/icon-button"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CandidateStatusBadge, type RecentCandidate } from "@/features/review-queue/client"

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
})

const helper = createColumnHelper<typeof features, RecentCandidate>()

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" })

/** Opportunity classes are persisted as PascalCase identifiers; readers get spaced words. */
function humanizeClassName(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
}

/** Deep link that opens the Review Queue with this candidate already selected. */
function reviewHref(candidateId: string): string {
  return `/review?candidate=${encodeURIComponent(candidateId)}`
}

const columns = helper.columns([
  helper.accessor("name", {
    header: "Business",
    sortFn: sortFn_text,
    cell: (context) => (
      // An explicit width, rather than a maximum, so truncation is not at the mercy of automatic
      // table layout deciding the column deserves more room.
      <div className="w-[152px] @xl:w-[224px]">
        <span className="block truncate font-medium" title={context.getValue()}>
          {context.getValue()}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {context.row.original.locality}
        </span>
      </div>
    ),
  }),
  helper.accessor("primaryOpportunity", {
    header: "Leading Opportunity",
    sortFn: sortFn_text,
    cell: (context) => (
      <span className="text-muted-foreground">{humanizeClassName(context.getValue())}</span>
    ),
  }),
  helper.accessor("score", {
    header: "Score",
    sortFn: sortFn_basic,
    sortDescFirst: true,
    cell: (context) => <span className="tabular-nums font-medium">{context.getValue()}</span>,
  }),
  helper.accessor("contactAvailable", {
    header: "Contact Route",
    enableSorting: false,
    cell: (context) => (
      <span className="text-muted-foreground">{context.getValue() ? "Available" : "None"}</span>
    ),
  }),
  helper.accessor("reviewStatus", {
    header: "Review Status",
    sortFn: sortFn_text,
    cell: (context) => <CandidateStatusBadge status={context.getValue()} />,
  }),
  helper.accessor("scoredAt", {
    header: "Scored",
    sortFn: sortFn_text,
    sortDescFirst: true,
    cell: (context) => (
      <time dateTime={context.getValue()} className="text-xs text-muted-foreground">
        {dateFormat.format(new Date(context.getValue()))}
      </time>
    ),
  }),
  helper.display({
    id: "actions",
    header: "Actions",
    cell: (context) => <RowActions candidate={context.row.original} />,
  }),
])

/**
 * Business names run long, so that column is pinned to a fixed width and truncated rather than being
 * allowed to push the rest of the grid sideways.
 */
/**
 * Column priority as the viewport narrows. The business, its score and the actions always stay; the
 * supporting columns drop away so the grid never has to scroll sideways.
 */
const columnClassNames: Readonly<Record<string, string>> = {
  // The content box inside is 16px narrower, matching the cell padding either side.
  name: "w-[168px] @xl:w-[240px]",
  reviewStatus: "hidden @md:table-cell",
  primaryOpportunity: "hidden @2xl:table-cell",
  scoredAt: "hidden @4xl:table-cell",
  contactAvailable: "hidden @4xl:table-cell",
  actions: "text-right",
}

const initialState = {
  sorting: [{ id: "scoredAt", desc: true }],
  pagination: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
}

const sortIcons = { asc: ArrowUp, desc: ArrowDown } as const

export function RecentCandidatesGrid({ candidates }: { candidates: readonly RecentCandidate[] }) {
  const data = useMemo(() => [...candidates], [candidates])
  const table = useTable({ features, columns, data, initialState })
  const rows = table.getRowModel().rows
  const { pageIndex, pageSize } = table.state.pagination

  return (
    <div className="grid gap-3">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => {
                if (header.isPlaceholder) return <TableHead key={header.id} />
                if (!header.column.getCanSort()) {
                  return (
                    <TableHead key={header.id} className={columnClassNames[header.column.id]}>
                      <table.FlexRender header={header} />
                    </TableHead>
                  )
                }
                const direction = header.column.getIsSorted()
                const SortIcon = direction ? sortIcons[direction] : ArrowUpDown
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={ariaSort(direction)}
                    className={columnClassNames[header.column.id]}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-2 h-7 px-2 font-medium"
                      onClick={() => header.column.toggleSorting()}
                    >
                      <table.FlexRender header={header} />
                      <SortIcon aria-hidden="true" className="text-muted-foreground" />
                    </Button>
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id} className={columnClassNames[cell.column.id]}>
                  {cell.column.id === "name" ? (
                    <Link
                      href={reviewHref(row.original.id)}
                      className="block min-w-0 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <table.FlexRender cell={cell} />
                    </Link>
                  ) : (
                    <table.FlexRender cell={cell} />
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <DataTablePagination
        pageIndex={pageIndex}
        pageSize={pageSize}
        pageCount={table.getPageCount()}
        rowsOnPage={rows.length}
        total={table.getRowCount()}
        canPrevious={table.getCanPreviousPage()}
        canNext={table.getCanNextPage()}
        onPrevious={() => table.previousPage()}
        onNext={() => table.nextPage()}
        onPageChange={(next) => table.setPageIndex(next)}
        onPageSizeChange={(size) => table.setPageSize(size)}
      />
    </div>
  )
}

/** Navigation shortcuts for a single candidate, so the grid is a launch point rather than a list. */
function RowActions({ candidate }: { candidate: RecentCandidate }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <IconLink label="Open In Review" href={reviewHref(candidate.id)}>
        <SquareArrowOutUpRight aria-hidden="true" />
      </IconLink>
      <IconLink label="Open Source Run" href={`/runs/${candidate.runId}`}>
        <Waypoints aria-hidden="true" />
      </IconLink>
    </div>
  )
}

function ariaSort(direction: false | "asc" | "desc") {
  if (direction === "asc") return "ascending"
  if (direction === "desc") return "descending"
  return "none"
}
