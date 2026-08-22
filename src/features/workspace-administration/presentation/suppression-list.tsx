"use client"

import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { DataTablePagination, DEFAULT_PAGE_SIZE } from "@/components/data-table-pagination"
import { Icon } from "@/components/icon"
import { SectionHeader } from "@/components/page-layout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formatWorkspaceDate,
  type SuppressionRecord,
} from "@/features/workspace-administration/client"

type SuppressionRow = SuppressionRecord & Readonly<{ lift: () => void; pending: boolean }>

/** One map, so a header and its cells cannot drift apart as the table narrows. */
const columnClass: Readonly<Record<string, string | undefined>> = {
  createdAt: "hidden @2xl:table-cell",
  actions: "text-right",
}
const sortIcons = { asc: ArrowUpIcon, desc: ArrowDownIcon } as const

function ariaSort(direction: false | "asc" | "desc") {
  if (direction === "asc") return "ascending"
  if (direction === "desc") return "descending"
  return "none"
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
})
const helper = createColumnHelper<typeof features, SuppressionRow>()
const columns = helper.columns([
  helper.accessor("businessName", {
    header: "Business",
    sortFn: sortFn_text,
    cell: (context) => <span className="font-medium">{context.getValue()}</span>,
  }),
  helper.accessor("reason", {
    header: "Reason",
    sortFn: sortFn_text,
    cell: (context) => <span className="text-muted-foreground">{context.getValue()}</span>,
  }),
  helper.accessor("createdAt", {
    header: "Suppressed",
    sortFn: sortFn_text,
    cell: (context) => (
      <time dateTime={context.getValue()} className="whitespace-nowrap text-muted-foreground">
        {formatWorkspaceDate(context.getValue())}
      </time>
    ),
  }),
  helper.display({
    id: "actions",
    header: "Actions",
    cell: (context) => (
      <Button
        variant="outline"
        size="sm"
        disabled={context.row.original.pending}
        onClick={context.row.original.lift}
      >
        {context.row.original.pending ? "Lifting…" : "Lift Suppression"}
      </Button>
    ),
  }),
])

export function SuppressionList({
  suppressions,
  emptyIcon,
}: {
  suppressions: readonly SuppressionRecord[]
  emptyIcon: Parameters<typeof HugeiconsIcon>[0]["icon"]
}) {
  const router = useRouter()
  const [pending, setPending] = useState<string>()
  const [error, setError] = useState<string>()

  const lift = useCallback(
    async (suppression: SuppressionRecord) => {
      setPending(suppression.identityFingerprint)
      setError(undefined)
      try {
        const response = await fetch(
          `/api/workspace/suppressions/${encodeURIComponent(suppression.identityFingerprint)}`,
          { method: "DELETE" },
        )
        const body = response.ok ? undefined : ((await response.json()) as { error?: string })
        if (!response.ok) throw new Error(body?.error ?? "The suppression was not removed.")
        router.refresh()
      } catch (error) {
        setError(error instanceof Error ? error.message : "The action failed.")
      } finally {
        setPending(undefined)
      }
    },
    [router],
  )

  const data = useMemo(
    () =>
      suppressions.map((suppression) => ({
        ...suppression,
        pending: pending === suppression.identityFingerprint,
        lift: () => void lift(suppression),
      })),
    [suppressions, pending, lift],
  )
  const table = useTable({
    features,
    columns,
    data,
    initialState: { pagination: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE } },
  })
  const rows = table.getRowModel().rows
  const { pageIndex, pageSize } = table.state.pagination

  return (
    <section aria-labelledby="suppression-list-heading" className="flex flex-col gap-4">
      <SectionHeader
        title={<span id="suppression-list-heading">Suppressed Businesses</span>}
        description="Suppressed businesses stay out of future recommendations, reassessment and exports until their suppression is lifted."
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Suppression Not Lifted</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {suppressions.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={emptyIcon} />
            </EmptyMedia>
            <EmptyTitle>No Suppressed Businesses</EmptyTitle>
            <EmptyDescription>
              Suppressing a candidate in Review keeps it out of future results and exports.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-2">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => {
                    const direction = header.column.getIsSorted()
                    const sortIcon = direction ? sortIcons[direction] : ArrowUpDownIcon
                    return (
                      <TableHead
                        key={header.id}
                        className={columnClass[header.column.id]}
                        aria-sort={ariaSort(direction)}
                      >
                        {header.column.getCanSort() ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-2 h-7 px-2 font-medium"
                            onClick={() => header.column.toggleSorting()}
                          >
                            <table.FlexRender header={header} />
                            <Icon icon={sortIcon} className="text-muted-foreground" />
                          </Button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
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
                    <TableCell key={cell.id} className={columnClass[cell.column.id]}>
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
            total={suppressions.length}
            canPrevious={table.getCanPreviousPage()}
            canNext={table.getCanNextPage()}
            onPrevious={() => table.previousPage()}
            onNext={() => table.nextPage()}
            onPageChange={(index) => table.setPageIndex(index)}
            onPageSizeChange={(size) => table.setPageSize(size)}
          />
        </div>
      )}
    </section>
  )
}
