import { expect, test } from "@playwright/test"

test.describe.configure({ mode: "serial" })

test("reviews a candidate in a panel without leaving the queue", async ({ page }) => {
  await page.goto("/review")

  // The queue is a full-width grid now, so it keeps its width however many candidates there are.
  await expect(page.getByRole("columnheader", { name: /Business/ })).toBeVisible()
  await expect(page.getByLabel("Rows Per Page")).toBeVisible()

  await page.getByRole("button", { name: "Open For Review" }).first().click()

  // The decisions that dominate reviewing are reachable straight away, not behind a tab.
  const shortlist = page.getByRole("button", { name: /Shortlist/ })
  await expect(shortlist).toBeVisible()
  await expect(page.getByRole("tab", { name: "Evidence" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Decision" })).toBeVisible()

  // Rejecting asks for the reason the write requires, rather than failing after the fact.
  await page.getByRole("button", { name: /^Reject/ }).click()
  await expect(page.getByLabel("Rejection Reason")).toBeVisible()
})

test("keeps the review page inside the viewport while showing long evidence", async ({ page }) => {
  await page.goto("/review")
  await page.getByRole("button", { name: "Open For Review" }).first().click()
  await expect(page.getByRole("tab", { name: "Evidence" })).toBeVisible()

  // The panel scrolls internally; the document behind it must not grow.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  )
  expect(overflow).toBeLessThanOrEqual(4)
})
