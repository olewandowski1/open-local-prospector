"use client"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** The page sizes offered unless a grid asks for its own. */
export const DEFAULT_PAGE_SIZES = [10, 25, 50, 100] as const

/** The page size every paged grid starts on. */
export const DEFAULT_PAGE_SIZE = 25

/**
 * The 1-based range of rows on show. Derived from how many rows the page actually rendered rather than
 * the page size, so a final short page reports its real end instead of an optimistic one.
 */
export function visibleRange(
  pageIndex: number,
  pageSize: number,
  rowsOnPage: number,
  total: number,
): Readonly<{ first: number; last: number }> {
  if (total === 0 || rowsOnPage === 0) return { first: 0, last: 0 }
  const offset = pageIndex * pageSize
  return { first: offset + 1, last: offset + rowsOnPage }
}

export type PaginationSlot = number | "ellipsis"

/** Pairs each slot with a stable key: a gap is named for the page that follows it. */
function keyedSlots(
  slots: readonly PaginationSlot[],
): readonly Readonly<{ slot: PaginationSlot; key: string }>[] {
  return slots.map((slot, position) => ({
    slot,
    key: slot === "ellipsis" ? `gap-before-${slots[position + 1] ?? "end"}` : `page-${slot}`,
  }))
}

/**
 * Which page links to show. The first, last and current pages are always reachable, with the pages
 * either side of the current one for stepping, and a gap marker wherever pages were left out.
 */
export function paginationWindow(
  pageIndex: number,
  pageCount: number,
  neighbours = 1,
): readonly PaginationSlot[] {
  if (pageCount <= 1) return pageCount === 1 ? [0] : []

  const last = pageCount - 1
  const shown = new Set<number>([0, last, pageIndex])
  for (let step = 1; step <= neighbours; step += 1) {
    if (pageIndex - step >= 0) shown.add(pageIndex - step)
    if (pageIndex + step <= last) shown.add(pageIndex + step)
  }

  const slots: PaginationSlot[] = []
  let previous: number | undefined
  for (const page of [...shown].sort((left, right) => left - right)) {
    const gap = previous === undefined ? 0 : page - previous - 1
    // A marker standing in for a single page costs the same room as the page itself, so show the page.
    if (gap === 1) slots.push(page - 1)
    else if (gap > 1) slots.push("ellipsis")
    slots.push(page)
    previous = page
  }
  return slots
}

/**
 * The pager for every client-paged table in the workspace: a page size, the visible range, and the
 * page links themselves. It takes plain numbers rather than a table instance so each grid can share it
 * regardless of which TanStack features that grid registers.
 */
export function DataTablePagination({
  pageIndex,
  pageSize,
  pageCount,
  rowsOnPage,
  total,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  onPageChange,
  onPageSizeChange,
  pageSizes = DEFAULT_PAGE_SIZES,
}: Readonly<{
  pageIndex: number
  pageSize: number
  pageCount: number
  rowsOnPage: number
  total: number
  canPrevious: boolean
  canNext: boolean
  onPrevious: () => void
  onNext: () => void
  onPageChange: (pageIndex: number) => void
  onPageSizeChange: (size: number) => void
  pageSizes?: readonly number[]
}>) {
  const { first, last } = visibleRange(pageIndex, pageSize, rowsOnPage, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Rows Per Page</span>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger size="sm" aria-label="Rows Per Page" className="w-[4.5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {pageSizes.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground tabular-nums">
          {first}&ndash;{last} / {total}
        </span>

        {/* The nav is width-fit here rather than centred, because it shares a row with the range. */}
        <Pagination className="mx-0 w-fit justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                size="icon-sm"
                aria-disabled={!canPrevious}
                data-disabled={!canPrevious || undefined}
                className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
                onClick={() => canPrevious && onPrevious()}
              />
            </PaginationItem>

            {keyedSlots(paginationWindow(pageIndex, pageCount)).map(({ slot, key }) =>
              slot === "ellipsis" ? (
                <PaginationItem key={key}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={key}>
                  <PaginationLink
                    size="icon-sm"
                    isActive={slot === pageIndex}
                    aria-label={`Page ${slot + 1}`}
                    className="tabular-nums"
                    onClick={() => onPageChange(slot)}
                  >
                    {slot + 1}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}

            <PaginationItem>
              <PaginationNext
                size="icon-sm"
                aria-disabled={!canNext}
                data-disabled={!canNext || undefined}
                className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
                onClick={() => canNext && onNext()}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  )
}
