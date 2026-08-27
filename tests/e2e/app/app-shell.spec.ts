import { expect, test } from "@playwright/test"
import { expectPageScroll, pageScroller } from "@/test-support/e2e-page-scroll"

test("renders the persisted overview without sample data", async ({ page, isMobile }) => {
  await page.goto("/")

  await expect(page).toHaveTitle("Open Prospector")
  if (!isMobile) {
    const brandLink = page.getByRole("link", { name: "Open Prospector" })
    await expect(brandLink).toBeVisible()
    await expect(brandLink.locator("svg")).toBeVisible()
  }
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute(
    "href",
    /\/icon\.svg\?/,
  )
  await expect(page.locator("main")).toHaveCount(1)
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

test("scrolls the overview inside the bounded app shell", async ({ page }) => {
  await page.goto("/")
  await expectPageScroll(page, 160)
})

test("scrolls from the gutter outside the centered page content", async ({ page, isMobile }) => {
  test.skip(isMobile, "The narrow viewport has no page gutter")
  await page.setViewportSize({ width: 1600, height: 600 })
  await page.goto("/")

  const scroller = pageScroller(page)
  const content = page.locator("[data-page-content]")
  const scrollerBox = await scroller.boundingBox()
  const contentBox = await content.boundingBox()
  expect(scrollerBox).not.toBeNull()
  expect(contentBox).not.toBeNull()
  if (!scrollerBox || !contentBox) return

  expect(contentBox.width).toBeLessThan(scrollerBox.width)
  const gutterX = (contentBox.x + contentBox.width + scrollerBox.x + scrollerBox.width) / 2
  await page.mouse.move(gutterX, scrollerBox.y + 100)
  await page.mouse.wheel(0, 300)

  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
})

test("scrolls Settings as one page instead of an inner content pane", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 600 })
  await page.goto("/settings/data")

  await expectPageScroll(page)

  // No descendant may become a second vertical scroll owner for the settings content.
  const nestedOwners = await pageScroller(page).evaluate(
    (element) =>
      [...element.querySelectorAll("*")].filter((candidate) => {
        const style = getComputedStyle(candidate)
        return (
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          candidate.scrollHeight > candidate.clientHeight + 1
        )
      }).length,
  )
  expect(nestedOwners).toBe(0)
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
      const unavailable = steering().getByText("No Authenticated Runtime")
      await expect(effortOf(steering()).or(unavailable).first()).toBeVisible()
      test.skip(await unavailable.isVisible(), "No authenticated local runtime is available")

      const original = (await effortOf(steering()).textContent())?.trim() ?? ""
      const replacement = original === "Low" ? "Medium" : "Low"

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
      await expect(page.getByRole("button", { name: "Active Runtime" })).toBeVisible()
      await page.reload()
      await expect(page.getByRole("button", { name: "Active Runtime" })).toBeVisible()
    })
  })

test("renders the persisted candidates", async ({ page }) => {
  await page.goto("/review")

  await expect(page.getByRole("heading", { name: "Candidates" })).toBeVisible()
  // The local database may hold qualified candidates or none; neither state may use fixtures.
  const empty = page.getByText(/nothing to review yet/i)
  const queue = page.getByRole("columnheader", { name: /Business/ })
  await expect(empty.or(queue).first()).toBeVisible()
  await expect(page.getByText("sample data")).toHaveCount(0)
  // Starting a run belongs to the Runs page; Candidates only offers it when there is nothing to review.
  await expect(page.getByRole("main").getByRole("link", { name: "New Run" })).toHaveCount(
    (await empty.count()) > 0 ? 1 : 0,
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

  const sidebar = page.getByRole("dialog", { name: /Sidebar/ })
  // Under a loaded dev server the document can be interactive before the client bundle attaches, so
  // the first click is sometimes a no-op. Retry opening, but only while it is still closed, so a
  // click that did land is never toggled back shut.
  await expect(async () => {
    if (!(await sidebar.isVisible())) {
      await page.getByRole("button", { name: "Toggle Sidebar" }).click()
    }
    await expect(sidebar).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 20_000 })

  await expect(sidebar).toContainText(/overview/i)
  await expect(sidebar).toContainText(/candidates/i)
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
  for (const section of ["General", "Appearance", "Subscription", "Data", "Maintenance"]) {
    await expect(sections.getByRole("link", { name: section })).toBeVisible()
  }
  await expect(sections.getByRole("link", { name: "General" })).toHaveAttribute(
    "aria-current",
    "page",
  )
})

test("reports local dependency readiness without rendering secrets", async ({ page }) => {
  await page.goto("/settings/general")

  await expect(page.getByRole("heading", { name: "Local Readiness" })).toBeVisible()
  const readiness = page.getByRole("list", { name: "Local Readiness Checklist" })
  await expect(readiness).toContainText("SQLite Database")
  await expect(readiness).toContainText("Playwright Chromium")
  await expect(readiness).toContainText("Storage Capacity")
  await expect(readiness.getByText("Ready", { exact: true })).toHaveCount(3)
  await expect(page.locator("body")).not.toContainText("accessToken")

  await page.getByRole("link", { name: "Subscription" }).click()
  const runtimes = page.getByRole("region", { name: "Subscription runtimes" })
  // The section streams in only once every provider CLI has been probed.
  await expect(runtimes).toContainText("Codex", { timeout: 20_000 })
  await expect(runtimes).toContainText("Claude")
  await expect(runtimes).toContainText("OpenCode")
  await expect(page.locator("body")).not.toContainText("accessToken")
})

test("persists the appearance choice on this device", async ({ page }) => {
  // One dev server serves every worker, so first paint here can far exceed the default budget.
  test.slow()
  await page.goto("/settings/appearance")

  // Choosing a theme is a client action, so it retries until the bundle has attached. Selecting the
  // same theme twice means the same thing, so repeating the click is safe.
  await expect(async () => {
    await page.getByRole("button", { name: "Dark", exact: true }).click()
    // Applied optimistically, then persisted to a cookie the server reads on the next render.
    await expect(page.locator("html")).toHaveClass(/dark/, { timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  await expect.poll(() => page.evaluate(() => document.cookie)).toContain("prospector-theme=dark")

  await page.reload()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await expect(page.getByRole("button", { name: "Dark", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )

  await expect(async () => {
    await page.getByRole("button", { name: "Light", exact: true }).click()
    await expect(page.locator("html")).not.toHaveClass(/dark/, { timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  await expect.poll(() => page.evaluate(() => document.cookie)).toContain("prospector-theme=light")
})

test("switches the runs list between table and card views", async ({ page }) => {
  await page.goto("/runs")

  const tableView = page.getByRole("radio", { name: "Table" })
  test.skip((await tableView.count()) === 0, "No persisted runs to display")

  await tableView.click()
  await expect(page.getByRole("table")).toBeVisible()
  // Supporting columns drop away on narrow viewports, so this asserts one that never does.
  await expect(page.getByRole("columnheader", { name: /Run/ }).first()).toBeVisible()

  await page.getByRole("radio", { name: "Cards" }).click()
  await expect(page.getByRole("table")).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole("radio", { name: "Cards" })).toBeChecked()
})

test("names every chrome icon button on hover", async ({ page, isMobile }) => {
  test.skip(isMobile, "Tooltips are a pointer affordance")
  // One dev server serves every worker, so first paint here can be far slower than the default budget.
  test.slow()
  await page.goto("/runs")

  // Icons alone carry no reliable meaning, so each icon-only control has to say what it does.
  // Settings navigates, so it is a link; the rest act on this page and are buttons.
  // The runtime control renames itself when a new release is published, so it is matched by pattern.
  const controls = [
    { label: "Toggle Sidebar", role: "button" as const },
    { label: "Search Workspace", role: "button" as const },
    { label: "Settings", role: "link" as const },
    { label: /Update (Runtimes|Available)/, role: "button" as const },
  ]

  // Base UI does not put role=tooltip on the popup, so these assert on the slot the primitive owns,
  // filtered by text because a closing tooltip briefly overlaps the one being opened.
  const tooltipFor = (label: string | RegExp) =>
    page.locator('[data-slot="tooltip-content"]').filter({ hasText: label })

  // Establish once that the client bundle has attached, retrying only here. The pointer is parked away
  // from the control first, because hovering an element the mouse already sits on fires no new events,
  // so a retry could otherwise never recover from an attempt made too early.
  const [first, ...rest] = controls
  await expect(async () => {
    await page.mouse.move(0, 0)
    await page.getByRole(first.role, { name: first.label }).first().hover()
    await expect(tooltipFor(first.label)).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })

  // The page is interactive now, so the rest need no retry budget of their own.
  for (const { label, role } of rest) {
    await page.mouse.move(0, 0)
    await page.getByRole(role, { name: label }).first().hover()
    await expect(tooltipFor(label)).toBeVisible()
  }
})
