import { expect, test } from "@playwright/test"

test("renders the persisted review queue empty state", async ({ page }) => {
  await page.goto("/")

  await expect(page).toHaveTitle("Local Prospector")
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible()
  await expect(page.getByText("No qualified candidates yet")).toBeVisible()
  await expect(page.getByText("sample data")).toHaveCount(0)
  await expect(page.getByRole("main").getByRole("link", { name: "New run" })).toHaveAttribute(
    "href",
    "/runs/new",
  )
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
  await expect(page.getByRole("option", { name: "Start a new run" })).toBeVisible()
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

test("reports local dependency readiness without rendering secrets", async ({ page }) => {
  await page.goto("/settings")

  await expect(page.getByRole("heading", { name: "Local readiness" })).toBeVisible()
  const readiness = page.getByRole("region", { name: "Local dependency readiness" })
  await expect(readiness).toContainText("SQLite")
  await expect(readiness).toContainText("Playwright Chromium")
  await expect(readiness).toContainText("Artifact storage")
  const runtimes = page.getByRole("region", { name: "Subscription runtimes" })
  await expect(runtimes).toContainText("Codex CLI")
  await expect(runtimes).toContainText("Claude Code")
  await expect(runtimes).toContainText("OpenCode")
  await expect(page.getByText("No search API key required")).toBeVisible()
  await expect(page.locator("body")).not.toContainText("accessToken")
})

test("persists a ready runtime selection when a local subscription is available", async ({
  page,
}) => {
  await page.goto("/settings")
  const available = page.getByRole("button", { name: "Use runtime" })
  test.skip((await available.count()) === 0, "No authenticated local runtime is available")

  await available.first().click()
  await expect(page.getByRole("button", { name: "Selected" })).toBeVisible()
  await page.reload()
  await expect(page.getByRole("button", { name: "Selected" })).toBeVisible()
})
