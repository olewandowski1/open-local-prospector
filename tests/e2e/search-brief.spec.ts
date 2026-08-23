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
  await expect(preflightButton).toBeEnabled({ timeout: 15_000 })

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
  await expect(preflightButton).toBeEnabled({ timeout: 15_000 })
  await page.getByLabel("City or municipality").fill("Kraków")
  await page.getByLabel("Target businesses").fill("5")
  await Promise.all([
    page.waitForRequest("**/api/prospecting-runs/preflight"),
    preflightButton.click(),
  ])

  await expect(page.getByText("Playwright")).toBeVisible()
  await expect(page.getByRole("button", { name: "Confirm and create run" })).toBeDisabled()
})
