import { expect, test } from "@playwright/test"

const searchAreas = [
  {
    id: "relation:62422",
    displayName: "Berlin, Deutschland",
    latitude: 52.517,
    longitude: 13.3889,
    countryCode: "DE",
  },
  {
    id: "way:2",
    displayName: "Berlin, New Hampshire, United States",
    latitude: 44.4687,
    longitude: -71.1851,
    countryCode: "US",
  },
]

test.beforeEach(async ({ page }) => {
  await page.route("**/api/search-brief/bootstrap", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        selectedRuntime: "codex",
      }),
    })
  })
  await page.route("**/api/search-brief/runtimes", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        runtimes: [
          {
            runtimeId: "codex",
            label: "Codex",
            status: "Ready",
            version: "1.0.0",
            detail: "Ready",
          },
        ],
      }),
    })
  })
})

test("renders the brief while subscription runtimes are still loading", async ({ page }) => {
  let releaseRuntimeCheck = () => {}
  const runtimeCheckHeld = new Promise<void>((resolve) => {
    releaseRuntimeCheck = resolve
  })
  await page.route("**/api/search-brief/runtimes", async (route) => {
    await runtimeCheckHeld
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ runtimes: [] }),
    })
  })

  await page.goto("/runs")
  await page.getByRole("button", { name: "New Run" }).click()

  await expect(page.getByLabel("City Or Municipality")).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole("status", { name: "Checking Subscription Runtimes" })).toBeVisible()
  releaseRuntimeCheck()
  await expect(page.getByText("No Subscription Runtime Is Ready")).toBeVisible()
})

test("keeps the compact Run Mode options centered and stable when selected", async ({ page }) => {
  await page.goto("/runs")
  await page.getByRole("button", { name: "New Run" }).click()
  const quick = page.getByRole("radio", { name: "Quick" })
  const thorough = page.getByRole("radio", { name: "Thorough" })
  await expect(quick).toBeVisible({ timeout: 15_000 })

  const metrics = () =>
    quick.evaluate((radio) => {
      const group = radio.closest('[data-slot="radio-group"]')
      if (!group) throw new Error("Run Mode group not found")
      return {
        group: group.getBoundingClientRect().toJSON(),
        segments: [...group.querySelectorAll("label")].map((label) => {
          const segment = label.lastElementChild
          const icon = segment?.querySelector("svg")
          const text = segment?.querySelector("span")
          if (!segment || !icon || !text) throw new Error("Run Mode segment is incomplete")
          return {
            segment: segment.getBoundingClientRect().toJSON(),
            icon: icon.getBoundingClientRect().toJSON(),
            text: text.getBoundingClientRect().toJSON(),
          }
        }),
      }
    })

  const before = await metrics()
  for (const { segment, icon, text } of before.segments) {
    expect(segment.top).toBe(before.group.top + 1)
    expect(segment.bottom).toBe(before.group.bottom - 1)
    expect(
      Math.abs((icon.top + icon.bottom) / 2 - (segment.top + segment.bottom) / 2),
    ).toBeLessThan(1)
    expect(
      Math.abs((text.top + text.bottom) / 2 - (segment.top + segment.bottom) / 2),
    ).toBeLessThan(1)
  }

  await thorough.click()
  await expect(thorough).toBeChecked()
  const after = await metrics()
  expect({ width: after.group.width, height: after.group.height }).toEqual({
    width: before.group.width,
    height: before.group.height,
  })
  expect(
    after.segments.map(({ segment, icon, text }) => ({
      segment: { width: segment.width, height: segment.height },
      icon: {
        width: icon.width,
        height: icon.height,
        left: icon.left - segment.left,
        top: icon.top - segment.top,
      },
      text: {
        width: text.width,
        height: text.height,
        left: text.left - segment.left,
        top: text.top - segment.top,
      },
    })),
  ).toEqual(
    before.segments.map(({ segment, icon, text }) => ({
      segment: { width: segment.width, height: segment.height },
      icon: {
        width: icon.width,
        height: icon.height,
        left: icon.left - segment.left,
        top: icon.top - segment.top,
      },
      text: {
        width: text.width,
        height: text.height,
        left: text.left - segment.left,
        top: text.top - segment.top,
      },
    })),
  )
})

test("requires explicit Search Area selection for an ambiguous non-Polish custom brief", async ({
  page,
}) => {
  let submittedDraft: Record<string, unknown> | undefined
  await page.route("**/api/prospecting-runs/preflight", async (route) => {
    submittedDraft = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        draft: submittedDraft,
        searchAreas,
        dependencies: [
          { id: "sqlite", label: "SQLite", status: "Ready", detail: "Ready" },
          { id: "playwright", label: "Playwright", status: "Ready", detail: "Ready" },
          { id: "disk", label: "Artifact Storage", status: "Ready", detail: "Ready" },
        ],
        runtime: { runtimeId: "codex", label: "Codex", status: "Ready", detail: "Ready" },
        estimate: {
          discoveryQueries: 13,
          likelyInspections: 125,
          duration: "100–180 minutes",
          note: "An operational estimate, not a provider subscription cost quote.",
        },
        ready: true,
      }),
    })
  })
  await page.goto("/runs")
  await page.getByRole("button", { name: "New Run" }).click()
  const preflightButton = page.getByRole("button", { name: "Check Preflight" })
  await expect(preflightButton).toBeVisible({ timeout: 15_000 })
  test.skip(
    await page.getByText("No subscription runtime is ready").isVisible(),
    "No ready local subscription runtime is available",
  )
  await expect(preflightButton).toBeEnabled({ timeout: 30_000 })

  await page.getByLabel("City or municipality").fill("Berlin, Germany")
  await page.getByLabel("Target businesses").fill("50")
  await page.getByRole("combobox", { name: "Business category" }).click()
  await page.getByRole("option", { name: "Custom category" }).click()
  await page.getByLabel("Custom category").fill("Independent climbing gyms")
  await page.getByText("Thorough", { exact: true }).click()
  await page.getByRole("combobox", { name: "Recently Assessed Businesses" }).click()
  await page.getByRole("option", { name: "Include existing assessment" }).click()
  await Promise.all([
    page.waitForRequest("**/api/prospecting-runs/preflight"),
    preflightButton.click(),
  ])

  expect(submittedDraft).toMatchObject({
    location: "Berlin, Germany",
    targetCount: 50,
    category: "Independent climbing gyms",
    mode: "Thorough",
    recentBusinessPolicy: "IncludeWithoutReassessment",
  })
  await expect(page.getByText("Select the intended Search Area explicitly.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Confirm and create run" })).toBeDisabled()
  await page.getByText("Berlin, Deutschland", { exact: true }).click()
  await expect(page.getByRole("button", { name: "Confirm and create run" })).toBeEnabled()
})

test("keeps confirmation disabled after failed preflight", async ({ page }) => {
  await page.route("**/api/prospecting-runs/preflight", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        draft: route.request().postDataJSON(),
        searchAreas: [searchAreas[0]],
        dependencies: [
          { id: "sqlite", label: "SQLite", status: "Ready", detail: "Ready" },
          { id: "playwright", label: "Playwright", status: "Missing", detail: "Missing" },
          { id: "disk", label: "Artifact Storage", status: "Ready", detail: "Ready" },
        ],
        runtime: { runtimeId: "codex", label: "Codex", status: "Ready", detail: "Ready" },
        estimate: {
          discoveryQueries: 3,
          likelyInspections: 8,
          duration: "3–6 minutes",
          note: "An operational estimate, not a provider subscription cost quote.",
        },
        ready: false,
      }),
    })
  })
  await page.goto("/runs")
  await page.getByRole("button", { name: "New Run" }).click()
  const preflightButton = page.getByRole("button", { name: "Check Preflight" })
  await expect(preflightButton).toBeVisible({ timeout: 15_000 })
  test.skip(
    await page.getByText("No subscription runtime is ready").isVisible(),
    "No ready local subscription runtime is available",
  )
  await expect(preflightButton).toBeEnabled({ timeout: 30_000 })
  await page.getByLabel("City or municipality").fill("Kraków")
  await page.getByLabel("Target businesses").fill("5")
  await Promise.all([
    page.waitForRequest("**/api/prospecting-runs/preflight"),
    preflightButton.click(),
  ])

  await expect(page.getByText("Playwright")).toBeVisible()
  await expect(page.getByRole("button", { name: "Confirm and create run" })).toBeDisabled()
})
