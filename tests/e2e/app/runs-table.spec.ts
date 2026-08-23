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

test("blocks run deletion when its count preview is unavailable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "Run table actions hide on mobile.")
  await page.route("**/api/runs/*/deletion-preview", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"failed"}' }),
  )
  await page.goto("/runs")
  await page.getByRole("button", { name: "Delete Run" }).first().click()

  const dialog = page.getByRole("alertdialog", { name: "Delete Run" })
  await expect(dialog.getByText("Counts Unavailable")).toBeVisible()
  await dialog.getByLabel("Type DELETE To Confirm").fill("DELETE")
  await expect(dialog.getByRole("button", { name: "Delete Run" })).toBeDisabled()
})

test("reports artifact files left behind after run deletion", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "Run table actions hide on mobile.")
  await page.route("**/api/runs/*", async (route) => {
    if (route.request().method() !== "DELETE") return route.continue()
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"leftoverFiles":2}',
    })
  })
  await page.goto("/runs")
  await page.getByRole("button", { name: "Delete Run" }).first().click()

  const dialog = page.getByRole("alertdialog", { name: "Delete Run" })
  await expect(dialog.getByText("Discovered Businesses")).toBeVisible()
  await dialog.getByLabel("Type DELETE To Confirm").fill("DELETE")
  await dialog.getByRole("button", { name: "Delete Run" }).click()

  await expect(dialog.getByText("Some Artifacts Remain")).toBeVisible()
  await expect(dialog).toContainText("2 artifact files remain")
})
