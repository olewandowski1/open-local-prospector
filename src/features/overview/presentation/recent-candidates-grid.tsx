"use client"

import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  LinkSquare02Icon,
  Route01Icon,
} from "@hugeicons/core-free-icons"
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
import Link from "next/link"
import { useMemo } from "react"
import { DataTablePagination, DEFAULT_PAGE_SIZE } from "@/components/data-table-pagination"
import { Icon } from "@/components/icon"
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
import {
  CandidateStatusBadge,
  formatScore,
  type RecentCandidate,
} from "@/features/review-queue/client"

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
})

const helper = createColumnHelper<typeof features, RecentCandidate>()

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" })

function humanizeClassName(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
}

function reviewHref(candidateId: string): string {
  return `/review?candidate=${encodeURIComponent(candidateId)}`
}

const columns = helper.columns([
  helper.accessor("name", {
    header: "Business",
    sortFn: sortFn_text,
    cell: (context) => (
      // An explicit width, not a maximum, which automatic table layout is free to overrule.
      <div className="w-[152px] @xl:w-[224px] @2xl:w-[184px]">
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
    header: "Opportunity",
    sortFn: sortFn_text,
    cell: (context) => (
      <span
        className="block truncate text-muted-foreground"
        title={humanizeClassName(context.getValue())}
      >
        {humanizeClassName(context.getValue())}
      </span>
    ),
  }),
  helper.accessor("score", {
    header: "Score",
    sortFn: sortFn_basic,
    sortDescFirst: true,
    cell: (context) => (
      <span className="tabular-nums font-medium">{formatScore(context.getValue())}</span>
    ),
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

// Columns drop away in ascending order of usefulness, so the grid never scrolls sideways.
const columnClassNames: Readonly<Record<string, string>> = {
  // The content box is 16px narrower, matching the cell padding either side.
  name: "w-[168px] @xl:w-[240px] @2xl:w-[200px]",
  reviewStatus: "hidden @md:table-cell",
  primaryOpportunity: "hidden w-[160px] @2xl:table-cell",
  scoredAt: "hidden @4xl:table-cell",
  contactAvailable: "hidden @4xl:table-cell",
  actions: "text-right",
}

const initialState = {
  sorting: [{ id: "scoredAt", desc: true }],
  pagination: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
}

const sortIcons = { asc: ArrowUpIcon, desc: ArrowDownIcon } as const

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
                const sortIcon = direction ? sortIcons[direction] : ArrowUpDownIcon
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
                      <Icon icon={sortIcon} className="text-muted-foreground" />
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

function RowActions({ candidate }: { candidate: RecentCandidate }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <IconLink label="Open In Review" href={reviewHref(candidate.id)}>
        <Icon icon={LinkSquare02Icon} />
      </IconLink>
      <IconLink label="Open Source Run" href={`/runs/${candidate.runId}`}>
        <Icon icon={Route01Icon} />
      </IconLink>
    </div>
  )
}

function ariaSort(direction: false | "asc" | "desc") {
  if (direction === "asc") return "ascending"
  if (direction === "desc") return "descending"
  return "none"
}
