import { expect, type Page } from "@playwright/test"

export function pageScroller(page: Page) {
  return page.locator('[data-page-scroller] [data-slot="scroll-area-viewport"]')
}

export async function pageCanScroll(page: Page) {
  return pageScroller(page).evaluate((element) => element.scrollHeight > element.clientHeight)
}

export async function expectPageScroll(page: Page, top = 180) {
  const scroller = pageScroller(page)
  await expect(scroller).toBeVisible()
  expect(await pageCanScroll(page)).toBe(true)
  await scroller.evaluate((element, nextTop) => element.scrollTo({ top: nextTop }), top)
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
}

export async function expectTablesDoNotScrollVertically(page: Page) {
  const tables = page.locator('[data-slot="table-container"]')
  for (let index = 0; index < (await tables.count()); index += 1) {
    expect(
      await tables.nth(index).evaluate((element) => element.scrollHeight - element.clientHeight),
    ).toBe(0)
  }
}
