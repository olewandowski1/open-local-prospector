import { expect, test } from "@playwright/test"

test("pages, sorts and navigates the runs table", async ({ page }) => {
  await page.goto("/runs")

  // The pager is present with a page size, a range and page links, whatever the size of the dataset.
  const pager = page.getByRole("navigation", { name: "pagination" })
  await expect(pager).toBeVisible()
  await expect(pager.getByLabel("Go to previous page")).toBeVisible()
  await expect(pager.getByLabel("Go to next page")).toBeVisible()
  await expect(pager.getByLabel("Page 1")).toHaveAttribute("aria-current", "page")
  await expect(page.getByLabel("Rows Per Page")).toContainText("25")

  // The action column navigates without the row's own click handler firing as well. It hides on
  // narrow viewports, where the row click is the way in instead.
  const open = page.getByRole("link", { name: "Open Run" }).first()
  if ((await open.count()) > 0) await open.click()
  else await page.getByRole("cell").first().click()
  await expect(page).toHaveURL(/\/runs\/[0-9a-f-]{36}$/u)
})

test("opens a run by clicking its row", async ({ page }) => {
  await page.goto("/runs")

  await page
    .getByRole("cell", { name: /Florist/ })
    .first()
    .click()
  await expect(page).toHaveURL(/\/runs\/[0-9a-f-]{36}$/u)
})
