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
import { useRouter } from "next/navigation"
import { useMemo } from "react"
import { DataTablePagination, DEFAULT_PAGE_SIZE } from "@/components/data-table-pagination"
import { Icon } from "@/components/icon"
import { IconLink } from "@/components/icon-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formatQualified,
  type RunRow,
} from "@/features/run-monitoring/presentation/run-presentation"
import { RunDeleteDialog } from "@/features/workspace-administration/client"

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
})

const helper = createColumnHelper<typeof features, RunRow>()

const columns = helper.columns([
  helper.accessor("category", {
    header: "Run",
    sortFn: sortFn_text,
    cell: (context) => (
      // An explicit width, not a maximum, which automatic table layout is free to overrule.
      <div className="w-[124px] @sm:w-[152px] @xl:w-[184px]">
        <span className="block truncate font-medium" title={context.getValue()}>
          {context.getValue()}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {context.row.original.location}
        </span>
      </div>
    ),
  }),
  helper.accessor((row) => row.status.label, {
    id: "status",
    header: "Status",
    sortFn: sortFn_text,
    cell: (context) => (
      <Badge
        variant={context.row.original.status.variant}
        title={context.row.original.status.detail}
      >
        {context.row.original.status.label}
      </Badge>
    ),
  }),
  helper.accessor("stage", {
    header: "Stage",
    sortFn: sortFn_text,
    cell: (context) => <span className="text-muted-foreground">{context.getValue()}</span>,
  }),
  helper.accessor("completion", {
    header: "Qualified",
    sortFn: sortFn_basic,
    sortDescFirst: true,
    cell: (context) => {
      const run = context.row.original
      return (
        <div className="flex min-w-32 items-center gap-2">
          <Progress value={context.getValue()} className="flex-1" />
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {formatQualified(run.qualified, run.targetCount)}
          </span>
        </div>
      )
    },
  }),
  helper.accessor("discovered", {
    header: "Discovered",
    sortFn: sortFn_basic,
    sortDescFirst: true,
    cell: (context) => <span className="tabular-nums">{context.getValue()}</span>,
  }),
  helper.accessor("updatedAt", {
    header: "Updated",
    sortFn: sortFn_text,
    sortDescFirst: true,
    cell: (context) => (
      <time
        dateTime={context.getValue()}
        className="text-xs whitespace-nowrap text-muted-foreground"
      >
        {context.row.original.updatedLabel}
      </time>
    ),
  }),
  helper.display({
    id: "actions",
    header: "Actions",
    cell: (context) => <RunActions run={context.row.original} />,
  }),
])

const initialState = {
  sorting: [{ id: "updatedAt", desc: true }],
  pagination: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
}

// Columns drop away in ascending order of usefulness, so the grid never scrolls sideways.
const columnClassNames: Readonly<Record<string, string>> = {
  // The content box is 16px narrower, matching the cell padding either side.
  category: "w-[140px] @sm:w-[168px] @xl:w-[200px]",
  completion: "hidden @2xl:table-cell",
  updatedAt: "hidden @2xl:table-cell",
  stage: "hidden @4xl:table-cell",
  discovered: "hidden @4xl:table-cell",
  // At the narrowest the actions step aside; the row click still opens the run.
  actions: "hidden text-right @sm:table-cell",
}
const sortIcons = { asc: ArrowUpIcon, desc: ArrowDownIcon } as const

export function RunsTable({ runs }: { runs: readonly RunRow[] }) {
  const router = useRouter()
  const data = useMemo(() => [...runs], [runs])
  const table = useTable({ features, columns, data, initialState })
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
                const direction = header.column.getIsSorted()
                const sortIcon = direction ? sortIcons[direction] : ArrowUpDownIcon
                if (!header.column.getCanSort()) {
                  return (
                    <TableHead key={header.id} className={columnClassNames[header.column.id]}>
                      <table.FlexRender header={header} />
                    </TableHead>
                  )
                }
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
            <TableRow
              key={row.id}
              onClick={(event) => {
                // The row opens the run, but the action column has its own links and they win.
                if ((event.target as HTMLElement).closest("a,button")) return
                router.push(`/runs/${row.original.id}`)
              }}
              className="cursor-pointer"
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

function RunActions({ run }: { run: RunRow }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <IconLink label="Open Run" href={`/runs/${run.id}`}>
        <Icon icon={LinkSquare02Icon} />
      </IconLink>
      <IconLink label="Open Review Queue" href="/review">
        <Icon icon={Route01Icon} />
      </IconLink>
      {run.settled ? (
        <RunDeleteDialog
          runId={run.id}
          runLabel={`${run.category} in ${run.location}`}
          afterDelete="/runs"
        />
      ) : null}
    </div>
  )
}

function ariaSort(direction: false | "asc" | "desc") {
  if (direction === "asc") return "ascending"
  if (direction === "desc") return "descending"
  return "none"
}
