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
import { ArrowDown, ArrowUp, ArrowUpDown, PanelRightOpen } from "lucide-react"
import { useMemo } from "react"

import { DataTablePagination, DEFAULT_PAGE_SIZE } from "@/components/data-table-pagination"
import { IconButton } from "@/components/icon-button"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CandidateStatusBadge } from "@/features/review-queue/presentation/candidate-status-badge"
import { formatScore, humanizeTerm } from "@/features/review-queue/presentation/review-presentation"
import type { QueueCandidate } from "@/features/review-queue/server/review-queue-read-model"
import { cn } from "@/lib/utils"

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
})

/** The row carries its own open handler so the column definitions can stay module-level. */
type ReviewRow = QueueCandidate & Readonly<{ onOpen: () => void }>

const helper = createColumnHelper<typeof features, ReviewRow>()

const columns = helper.columns([
  helper.accessor("name", {
    header: "Business",
    sortFn: sortFn_text,
    cell: (context) => (
      // An explicit width, so a long trading name truncates instead of widening the whole queue.
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
      <span className="text-muted-foreground">{humanizeTerm(context.getValue())}</span>
    ),
  }),
  helper.accessor("score", {
    header: "Score",
    sortFn: sortFn_basic,
    sortDescFirst: true,
    cell: (context) => (
      <span className="font-medium tabular-nums">{formatScore(context.getValue())}</span>
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
  helper.display({
    id: "actions",
    header: "Actions",
    cell: (context) => (
      <div className="flex items-center justify-end">
        <IconButton
          label="Open For Review"
          variant="ghost"
          size="icon-xs"
          onClick={context.row.original.onOpen}
        >
          <PanelRightOpen aria-hidden="true" />
        </IconButton>
      </div>
    ),
  }),
])

/**
 * Column priority as the viewport narrows. The business, its score and the actions always stay; the
 * supporting columns drop away so the queue never has to scroll sideways.
 */
const columnClassNames: Readonly<Record<string, string>> = {
  // The content box inside is 16px narrower, matching the cell padding either side.
  name: "w-[168px] @xl:w-[240px]",
  reviewStatus: "hidden @md:table-cell",
  primaryOpportunity: "hidden @2xl:table-cell",
  contactAvailable: "hidden @4xl:table-cell",
  actions: "text-right",
}

const initialState = {
  sorting: [{ id: "score", desc: true }],
  pagination: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
}

const sortIcons = { asc: ArrowUp, desc: ArrowDown } as const

/**
 * The whole queue as one sortable, paged grid. Reviewing happens in a side panel rather than in a
 * second column, so the list keeps its full width however many candidates a run produces.
 */
export function CandidatesTable({
  candidates,
  selectedId,
  onOpen,
}: {
  candidates: readonly QueueCandidate[]
  selectedId?: string
  onOpen: (id: string) => void
}) {
  const data = useMemo<readonly ReviewRow[]>(
    () => candidates.map((candidate) => ({ ...candidate, onOpen: () => onOpen(candidate.id) })),
    [candidates, onOpen],
  )
  const table = useTable({ features, columns, data: data as ReviewRow[], initialState })
  const rows = table.getRowModel().rows
  const { pageIndex, pageSize } = table.state.pagination

  return (
    <div className="grid gap-2">
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
            <TableRow
              key={row.id}
              aria-current={row.original.id === selectedId ? "true" : undefined}
              className={cn(
                "cursor-pointer",
                row.original.id === selectedId && "bg-muted hover:bg-muted",
              )}
              onClick={(event) => {
                // The row opens the panel, but the action column has its own control and it wins.
                if ((event.target as HTMLElement).closest("a,button")) return
                onOpen(row.original.id)
              }}
            >
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id} className={columnClassNames[cell.column.id]}>
                  <table.FlexRender cell={cell} />
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

function ariaSort(direction: false | "asc" | "desc") {
  if (direction === "asc") return "ascending"
  if (direction === "desc") return "descending"
  return "none"
}
