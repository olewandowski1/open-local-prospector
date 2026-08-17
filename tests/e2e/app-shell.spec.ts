import { expect, test } from "@playwright/test"

test("renders the persisted overview without sample data", async ({ page }) => {
  await page.goto("/")

  await expect(page).toHaveTitle("Local Prospector")
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Prospecting Summary" })).toContainText(
    "Businesses Discovered",
  )
  await expect(page.getByRole("region", { name: "Run Steering" })).toContainText("Run Steering")
  await expect(page.getByRole("region", { name: "Recent Candidates" })).toBeVisible()
  await expect(page.getByText("sample data")).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

// These write the single stored runtime preference. `serial` orders them within a project, and
// skipping mobile keeps the desktop and mobile projects from racing over the same database.
test.describe
  .serial("stored runtime preference", () => {
    test("persists the run steering choice for new runs", async ({ page, isMobile }) => {
      test.skip(isMobile, "Persistence is covered once; both projects share one database")
      await page.goto("/")

      const effortOf = (region: ReturnType<typeof page.getByRole>) =>
        region.getByRole("combobox", { name: "Reasoning Effort" })
      const steering = () => page.getByRole("region", { name: "Run Steering" })
      test.skip(
        await steering().getByText("No Authenticated Runtime").isVisible(),
        "No authenticated local runtime is available",
      )

      const original = (await effortOf(steering()).textContent())?.trim() ?? ""
      const replacement = original === "low" ? "medium" : "low"

      await effortOf(steering()).click()
      await page.getByRole("option", { name: replacement, exact: true }).click()
      await steering().getByRole("button", { name: "Save Steering" }).click()
      // The button re-disables once the stored preference matches the draft again.
      await expect(steering().getByRole("button", { name: "Save Steering" })).toBeDisabled()

      await page.reload()
      await expect(effortOf(steering())).toContainText(replacement)

      await effortOf(steering()).click()
      await page.getByRole("option", { name: original, exact: true }).click()
      await steering().getByRole("button", { name: "Save Steering" }).click()
      // The button re-disables once the stored preference matches the draft again.
      await expect(steering().getByRole("button", { name: "Save Steering" })).toBeDisabled()
    })

    test("persists a ready runtime selection when a local subscription is available", async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, "Persistence is covered once; both projects share one database")
      await page.goto("/settings/subscription")
      const available = page.getByRole("button", { name: "Use runtime" })
      test.skip((await available.count()) === 0, "No authenticated local runtime is available")

      await available.first().click()
      await expect(page.getByRole("button", { name: "Selected" })).toBeVisible()
      await page.reload()
      await expect(page.getByRole("button", { name: "Selected" })).toBeVisible()
    })
  })

test("renders the persisted review queue", async ({ page }) => {
  await page.goto("/review")

  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible()
  // The local database may hold qualified candidates or none; neither state may use fixtures.
  await expect(page.getByText(/no qualified candidates yet|ranked candidates/i)).toBeVisible()
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
  // The sidebar is identical on every page; /runs has no streamed section to re-render mid-click.
  await page.goto("/runs")

  await page.getByRole("button", { name: "Toggle Sidebar" }).click()
  const sidebar = page.getByRole("dialog", { name: /Sidebar/ })
  await expect(sidebar).toContainText(/overview/i)
  await expect(sidebar).toContainText(/review queue/i)
})

test("collapses desktop navigation", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-only behavior")
  await page.goto("/")

  await page.getByRole("button", { name: "Toggle Sidebar" }).click()
  await expect(page.locator('[data-slot="sidebar"][data-state]')).toHaveAttribute(
    "data-state",
    "collapsed",
  )
})

test("opens settings on the general section with a section list", async ({ page }) => {
  await page.goto("/settings")

  await expect(page).toHaveURL(/\/settings\/general$/)
  const sections = page.getByRole("navigation", { name: "Settings sections" })
  for (const section of ["General", "Appearance", "Subscription"]) {
    await expect(sections.getByRole("link", { name: section })).toBeVisible()
  }
  await expect(sections.getByRole("link", { name: "General" })).toHaveAttribute(
    "aria-current",
    "page",
  )
})

test("reports local dependency readiness without rendering secrets", async ({ page }) => {
  await page.goto("/settings/general")

  await expect(page.getByRole("heading", { name: "Local readiness" })).toBeVisible()
  const readiness = page.getByRole("region", { name: "Local dependency readiness" })
  await expect(readiness).toContainText("SQLite")
  await expect(readiness).toContainText("Playwright Chromium")
  await expect(readiness).toContainText("Artifact Storage")
  await expect(page.locator("body")).not.toContainText("accessToken")

  await page.getByRole("link", { name: "Subscription" }).click()
  const runtimes = page.getByRole("region", { name: "Subscription runtimes" })
  // The section streams in only once both provider CLIs have been probed.
  await expect(runtimes).toContainText("Codex", { timeout: 20_000 })
  await expect(runtimes).toContainText("Claude")
  await expect(runtimes).not.toContainText("OpenCode")
  await expect(page.locator("body")).not.toContainText("accessToken")
})

test("persists the appearance choice on this device", async ({ page }) => {
  await page.goto("/settings/appearance")

  await page.getByRole("radio", { name: "Dark" }).click()
  // Applied optimistically, then persisted to a cookie the server reads on the next render.
  await expect(page.locator("html")).toHaveClass(/dark/)
  await expect.poll(() => page.evaluate(() => document.cookie)).toContain("prospector-theme=dark")

  await page.reload()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked()

  await page.getByRole("radio", { name: "Light" }).click()
  await expect(page.locator("html")).not.toHaveClass(/dark/)
  await expect.poll(() => page.evaluate(() => document.cookie)).toContain("prospector-theme=light")
})

test("switches the runs list between table and card views", async ({ page }) => {
  await page.goto("/runs")

  const tableView = page.getByRole("radio", { name: "Table" })
  test.skip((await tableView.count()) === 0, "No persisted runs to display")

  await tableView.click()
  await expect(page.getByRole("table")).toBeVisible()
  await expect(page.getByRole("columnheader", { name: /Qualified/ })).toBeVisible()

  await page.getByRole("radio", { name: "Cards" }).click()
  await expect(page.getByRole("table")).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole("radio", { name: "Cards" })).toBeChecked()
})
