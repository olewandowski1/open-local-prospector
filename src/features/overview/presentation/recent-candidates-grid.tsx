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
import Link from "next/link"
import { useMemo } from "react"

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
})

const helper = createColumnHelper<typeof features, RecentCandidate>()

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" })

/** Opportunity classes are persisted as PascalCase identifiers; readers get spaced words. */
function humanizeClassName(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
}

const columns = helper.columns([
  helper.accessor("name", {
    header: "Business",
    sortFn: sortFn_text,
    cell: (context) => (
      <div className="min-w-0">
        <span className="block truncate font-medium">{context.getValue()}</span>
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
])

const initialState = { sorting: [{ id: "scoredAt", desc: true }] }

const sortIcons = { asc: ArrowUp, desc: ArrowDown } as const

export function RecentCandidatesGrid({ candidates }: { candidates: readonly RecentCandidate[] }) {
  const data = useMemo(() => [...candidates], [candidates])
  const table = useTable({ features, columns, data, initialState })

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => {
              if (header.isPlaceholder) return <TableHead key={header.id} />
              if (!header.column.getCanSort()) {
                return (
                  <TableHead key={header.id}>
                    <table.FlexRender header={header} />
                  </TableHead>
                )
              }
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
          <TableRow key={row.id}>
            {row.getAllCells().map((cell) => (
              <TableCell key={cell.id}>
                {cell.column.id === "name" ? (
                  <Link
                    href="/review"
                    className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
  )
}

function ariaSort(direction: false | "asc" | "desc") {
  if (direction === "asc") return "ascending"
  if (direction === "desc") return "descending"
  return "none"
}
