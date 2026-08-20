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
  await expect(page.getByRole("tab", { name: "Evidence" })).toBeVisible()
})
