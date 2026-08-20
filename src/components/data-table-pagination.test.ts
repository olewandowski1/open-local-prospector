import { describe, expect, it } from "vitest"

import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGE_SIZES,
  paginationWindow,
  visibleRange,
} from "@/components/data-table-pagination"

describe("visibleRange", () => {
  it("counts from one on the first page", () => {
    expect(visibleRange(0, 25, 25, 100)).toEqual({ first: 1, last: 25 })
  })

  it("offsets by the pages already behind it", () => {
    expect(visibleRange(1, 25, 25, 100)).toEqual({ first: 26, last: 50 })
    expect(visibleRange(3, 25, 25, 100)).toEqual({ first: 76, last: 100 })
  })

  it("reports what a short final page actually holds, not a full page", () => {
    expect(visibleRange(2, 25, 7, 57)).toEqual({ first: 51, last: 57 })
  })

  it("reads as empty rather than as a first row when there is nothing to show", () => {
    expect(visibleRange(0, 25, 0, 0)).toEqual({ first: 0, last: 0 })
    expect(visibleRange(0, 25, 0, 12)).toEqual({ first: 0, last: 0 })
  })

  it("handles a single row without claiming a range", () => {
    expect(visibleRange(0, 25, 1, 1)).toEqual({ first: 1, last: 1 })
  })
})

describe("page size defaults", () => {
  it("starts on a size the reader can also pick from the list", () => {
    expect(DEFAULT_PAGE_SIZES).toContain(DEFAULT_PAGE_SIZE)
  })

  it("offers sizes in ascending order", () => {
    expect([...DEFAULT_PAGE_SIZES]).toEqual([...DEFAULT_PAGE_SIZES].sort((a, b) => a - b))
  })
})

describe("paginationWindow", () => {
  it("lists every page while they all fit", () => {
    expect(paginationWindow(0, 4)).toEqual([0, 1, 2, 3])
  })

  it("says nothing when there is nothing to page", () => {
    expect(paginationWindow(0, 0)).toEqual([])
    expect(paginationWindow(0, 1)).toEqual([0])
  })

  it("keeps the first, last and current pages reachable, with a gap marker between", () => {
    expect(paginationWindow(5, 12)).toEqual([0, "ellipsis", 4, 5, 6, "ellipsis", 11])
  })

  it("opens no gap where pages are already adjacent", () => {
    expect(paginationWindow(1, 12)).toEqual([0, 1, 2, "ellipsis", 11])
    expect(paginationWindow(10, 12)).toEqual([0, "ellipsis", 9, 10, 11])
  })

  it("never repeats a page, however the window overlaps the ends", () => {
    for (let pageCount = 1; pageCount <= 14; pageCount += 1) {
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        const pages = paginationWindow(pageIndex, pageCount).filter(
          (slot): slot is number => slot !== "ellipsis",
        )
        expect(new Set(pages).size).toBe(pages.length)
        expect([...pages]).toEqual([...pages].sort((left, right) => left - right))
        expect(pages).toContain(pageIndex)
        expect(pages).toContain(0)
        expect(pages).toContain(pageCount - 1)
      }
    }
  })
})
