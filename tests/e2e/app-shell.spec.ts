import { expect, test } from "@playwright/test"

test("renders the prospecting overview", async ({ page }) => {
  await page.goto("/")

  await expect(page).toHaveTitle("Local Prospector")
  await expect(page.getByRole("heading", { name: "Good morning, Oliver" })).toBeVisible()
  await expect(page.getByText("Interface preview · sample data")).toBeVisible()
  await expect(page.getByRole("region", { name: "Prospecting summary" })).toContainText(
    "Businesses found",
  )
  await expect(page.getByRole("button", { name: "New prospecting run" })).toBeDisabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

test("opens and closes the command palette", async ({ page, isMobile }) => {
  await page.goto("/")

  if (isMobile) {
    await page.keyboard.press("Control+k")
  } else {
    await page.getByRole("button", { name: /Search/ }).click()
  }
  await expect(page.getByRole("combobox", { name: "Search workspace" })).toBeFocused()
  await expect(page.getByRole("option", { name: "Start a new run · Coming soon" })).toHaveAttribute(
    "data-disabled",
    "true",
  )
  await page.keyboard.press("Escape")
  await expect(page.getByRole("combobox", { name: "Search workspace" })).toBeHidden()
})

test("opens mobile navigation", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile-only behavior")
  await page.goto("/")

  await page.getByRole("button", { name: "Toggle Sidebar" }).click()
  await expect(page.getByRole("dialog", { name: /Sidebar/ })).toContainText("Review queue")
})

test("collapses desktop navigation", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-only behavior")
  await page.goto("/")

  await page.getByRole("button", { name: "Toggle Sidebar" }).click()
  await expect(page.getByText("Find businesses worth helping")).toBeHidden()
})
