import { expect, test } from "@playwright/test"
import {
  expectPageScroll,
  expectTablesDoNotScrollVertically,
  pageCanScroll,
} from "@/testing/page-scroll"

test.describe.configure({ mode: "serial" })

test("reviews a candidate in a panel without leaving the queue", async ({ page }) => {
  await page.goto("/review")

  // The queue is a full-width grid now, so it keeps its width however many candidates there are.
  await expect(page.getByRole("columnheader", { name: /Business/ })).toBeVisible()
  await expect(page.getByLabel("Rows Per Page")).toBeVisible()

  await page.getByRole("button", { name: "Open For Review" }).first().click()

  // Nothing is behind a tab: the decisions sit above the evidence, and the evidence is simply there.
  await expect(page.getByRole("button", { name: /Shortlist/ })).toBeVisible()
  await expect(page.getByRole("button", { name: "Mark Contacted" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Mark Archived" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Reset To Unreviewed" })).toBeVisible()
  await expect(page.getByRole("button", { name: "More Decisions" })).toHaveCount(0)
  await expect(page.getByRole("tab")).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Notes And Follow-Up" })).toBeVisible()

  // Rejecting is two clicks: reveal the reasons, then pick one. There is no form and no confirm step.
  await page
    .getByRole("button", { name: /^Reject/ })
    .first()
    .click()
  await expect(page.getByRole("button", { name: "Evidence Too Weak" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Not A Local Decision" })).toBeVisible()
})

test("keeps the review page inside the viewport while showing long evidence", async ({ page }) => {
  await page.goto("/review")
  await page.getByRole("button", { name: "Open For Review" }).first().click()
  await expect(page.getByRole("heading", { name: "Notes And Follow-Up" })).toBeVisible()

  // The panel scrolls internally; the document behind it must not grow.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  )
  expect(overflow).toBeLessThanOrEqual(4)
})

test("scrolls the review queue as one page instead of trapping its table", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 600 })
  await page.goto("/review")

  test.skip(!(await pageCanScroll(page)), "The persisted queue is not long enough to scroll")

  await expectTablesDoNotScrollVertically(page)
  await expectPageScroll(page)
})

test("keeps candidate evidence out of the queue payload", async ({ page, isMobile }) => {
  test.skip(isMobile, "One assertion about the served document is enough")

  const response = await page.goto("/review")
  const html = (await response?.text()) ?? ""

  // The grid needs six fields per candidate. Evidence belongs to the one candidate on screen, so it
  // must not be serialised for the whole queue — that payload grows with every run.
  for (const field of ["observations", "screenshots", "measurements", "limitations"]) {
    expect(html, `${field} should not be in the queue payload`).not.toContain(field)
  }

  // It arrives on demand instead.
  const detail = page.waitForResponse((res) => /\/api\/review\/[0-9a-f-]{36}$/u.test(res.url()))
  const open = page.getByRole("button", { name: "Open For Review" }).first()
  test.skip((await open.count()) === 0, "No candidates to review")
  await open.click()
  expect((await detail).ok()).toBe(true)
  await expect(page.getByRole("heading", { name: "Notes And Follow-Up" })).toBeVisible()
})
