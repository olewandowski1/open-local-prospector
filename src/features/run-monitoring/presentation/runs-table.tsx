"use client"

import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo } from "react"

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
import type { RunRow } from "@/features/run-monitoring/presentation/run-presentation"

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
})

const helper = createColumnHelper<typeof features, RunRow>()

const columns = helper.columns([
  helper.accessor("category", {
    header: "Run",
    sortFn: sortFn_text,
    cell: (context) => (
      // Search Areas resolve to long administrative names, so the column is bounded rather than
      // allowed to push the numeric columns out of view.
      <div className="max-w-64">
        <span className="block truncate font-medium">{context.getValue()}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {context.row.original.location}
        </span>
      </div>
    ),
  }),
  helper.accessor("status", {
    header: "Status",
    sortFn: sortFn_text,
    cell: (context) => (
      <Badge variant={context.row.original.settled ? "secondary" : "outline"}>
        {context.getValue()}
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
            {run.qualified}/{run.targetCount}
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
])

const initialState = { sorting: [{ id: "updatedAt", desc: true }] }
const sortIcons = { asc: ArrowUp, desc: ArrowDown } as const

export function RunsTable({ runs }: { runs: readonly RunRow[] }) {
  const router = useRouter()
  const data = useMemo(() => [...runs], [runs])
  const table = useTable({ features, columns, data, initialState })

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => {
              if (header.isPlaceholder) return <TableHead key={header.id} />
              const direction = header.column.getIsSorted()
              const SortIcon = direction ? sortIcons[direction] : ArrowUpDown
              return (
                <TableHead key={header.id} aria-sort={ariaSort(direction)}>
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
        {table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            onClick={() => router.push(`/runs/${row.original.id}`)}
            className="cursor-pointer"
          >
            {row.getAllCells().map((cell) => (
              <TableCell key={cell.id}>
                <table.FlexRender cell={cell} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ariaSort(direction: false | "asc" | "desc") {
  if (direction === "asc") return "ascending"
  if (direction === "desc") return "descending"
  return "none"
}
