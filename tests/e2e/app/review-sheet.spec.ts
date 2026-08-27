import { expect, test } from "@playwright/test"
import {
  expectPageScroll,
  expectTablesDoNotScrollVertically,
  pageCanScroll,
} from "@/test-support/e2e-page-scroll"

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

test("scrolls Candidates as one page instead of trapping its table", async ({ page }) => {
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

  // Candidate evidence must load on demand instead of growing the queue payload.
  for (const field of ["observations", "screenshots", "measurements", "limitations"]) {
    expect(html, `${field} should not be in the queue payload`).not.toContain(field)
  }

  const detail = page.waitForResponse((res) => /\/api\/review\/[0-9a-f-]{36}$/u.test(res.url()))
  const open = page.getByRole("button", { name: "Open For Review" }).first()
  test.skip((await open.count()) === 0, "No candidates to review")
  await open.click()
  expect((await detail).ok()).toBe(true)
  await expect(page.getByRole("heading", { name: "Notes And Follow-Up" })).toBeVisible()
})

test("shows captured pages and readable measurements without exposing artifact paths", async ({
  page,
}) => {
  await page.goto("/review")
  const row = page.getByRole("row", { name: /Willow And Stem/ })
  const detailResponse = page.waitForResponse((response) =>
    /\/api\/review\/[0-9a-f-]{36}$/u.test(response.url()),
  )
  await row.getByRole("button", { name: "Open For Review" }).click()

  const response = await detailResponse
  const detail = (await response.json()) as { screenshots: readonly Record<string, unknown>[] }
  expect(detail.screenshots).toHaveLength(1)
  expect(detail.screenshots[0]).not.toHaveProperty("path")
  await expect(page.getByText("Captured Pages", { exact: true })).toBeVisible()
  await expect(page.getByAltText(/Desktop website capture for Willow And Stem/)).toBeVisible()
  await expect(page.getByText("Page Measurements", { exact: true })).toBeVisible()
  await expect(page.getByText("1.23 s", { exact: true })).toBeVisible()
})

test("explains the deterministic score limits for blocked website evidence", async ({ page }) => {
  await page.route(/\/api\/review\/[0-9a-f-]{36}$/u, async (route) => {
    const response = await route.fetch()
    const detail = (await response.json()) as Record<string, unknown>
    await route.fulfill({
      response,
      json: {
        ...detail,
        inspectionState: "Blocked",
        rubricVersion: "opportunity-score-v2",
      },
    })
  })

  await page.goto("/review")
  await page.getByRole("button", { name: "Open For Review" }).first().click()

  const limitation = page.getByRole("alert")
  await expect(limitation).toContainText("Limited Website Evidence")
  await expect(limitation).toContainText("caps severity at 4 of 5 and confidence at 0.6")
})

test("starts a reassessment from the candidate and names the run it created", async ({ page }) => {
  await page.route(/\/api\/review\/[0-9a-f-]{36}\/reassess$/u, async (route) => {
    await route.fulfill({
      status: 201,
      json: { id: "11111111-2222-3333-4444-555555555555", state: "Pending" },
    })
  })

  await page.goto("/review")
  await page.getByRole("button", { name: "Open For Review" }).first().click()

  const sheet = page.getByRole("dialog")
  await sheet.getByRole("button", { name: "Reassess Business" }).click()

  await expect(sheet.getByText("Run #11111111 started.")).toBeVisible()
  await expect(sheet.getByRole("link", { name: "View Progress" })).toHaveAttribute(
    "href",
    "/runs/11111111-2222-3333-4444-555555555555",
  )
})

test("replaces a failed detail loader with a retryable error", async ({ page }) => {
  let attempts = 0
  await page.route(/\/api\/review\/[0-9a-f-]{36}$/u, async (route) => {
    attempts += 1
    if (attempts === 1) {
      await new Promise((resolve) => setTimeout(resolve, 1_000))
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Fixture candidate detail failed." }),
      })
      return
    }
    await route.continue()
  })

  await page.goto("/review")
  await page.getByRole("button", { name: "Open For Review" }).first().click()

  const loader = page.getByRole("status", { name: "Loading Candidate Details" })
  await expect(loader).toBeVisible()
  expect(await loader.locator('[data-slot="skeleton"]').count()).toBeGreaterThan(20)
  await expect(page.getByRole("alert")).toContainText("Fixture candidate detail failed.")
  await expect(loader).toHaveCount(0)

  await page.getByRole("button", { name: "Retry" }).click()
  await expect(page.getByRole("heading", { name: "Notes And Follow-Up" })).toBeVisible()
})
