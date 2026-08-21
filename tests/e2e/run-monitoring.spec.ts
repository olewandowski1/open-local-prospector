import { expect, test } from "@playwright/test"
import { expectPageScroll, expectTablesDoNotScrollVertically } from "@/test-support/e2e-page-scroll"

function runDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-e2e",
    state: "Running",
    currentStage: "InspectBusiness",
    requestedControl: "None",
    searchBrief: {
      location: "Kraków",
      category: "Dental clinics",
      targetCount: 5,
      mode: "Quick",
      runtime: "codex",
      searchArea: {
        id: "relation:276892",
        displayName: "Kraków, Polska",
        latitude: 50.0614,
        longitude: 19.9366,
        countryCode: "PL",
      },
    },
    progress: {
      queries: 2,
      discoveries: 8,
      duplicates: 1,
      exclusions: 2,
      websites: 4,
      assessments: 3,
      qualifiedCandidates: 2,
      blockedInspections: 1,
      targetRemaining: 3,
    },
    createdAt: "2026-08-16T10:00:00.000Z",
    updatedAt: "2026-08-16T10:01:00.000Z",
    version: 3,
    businesses: [],
    technicalLog: [],
    ...overrides,
  }
}

test("polls active progress and persists pause, resume, and cancellation controls", async ({
  page,
}) => {
  let detail = runDetail()
  await page.route(/\/api\/runs\/run-e2e(?:\/control)?$/u, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(detail) })
      return
    }
    const { control } = route.request().postDataJSON() as { control: string }
    detail =
      control === "Pause"
        ? runDetail({ state: "Paused", completionState: "Paused", requestedControl: "Pause" })
        : control === "Resume"
          ? runDetail({ state: "Running", requestedControl: "None" })
          : runDetail({
              state: "Cancelled",
              completionState: "Cancelled with Partial Results",
              requestedControl: "Cancel",
            })
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ accepted: true }),
    })
  })
  await page.goto("/runs/run-e2e")

  await expect(page.getByRole("heading", { name: "Run Progress" })).toBeVisible()
  await expect(page.getByText("Discoveries").locator("..")).toContainText("8")
  await page.getByRole("button", { name: "Pause" }).click()
  await expect(page.getByText("Paused", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Resume" }).click()
  await expect(page.getByText("Running", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Cancel" }).click()
  // Detail-page state is a labeled fact; the full recorded wording remains available as its title.
  const cancelled = page.getByText("Cancelled", { exact: true })
  await expect(cancelled).toBeVisible()
  await expect(cancelled).toHaveAttribute("title", "Cancelled with Partial Results")
  await expect(page.getByRole("button", { name: "Cancel" })).toBeHidden()
})

test("shows partial business failure and a separate factual Technical Run Log", async ({
  page,
}) => {
  await page.route("**/api/runs/run-e2e", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        runDetail({
          state: "Completed",
          completionState: "Completed with Warnings",
          businesses: [
            {
              id: "business-a",
              currentStage: "InspectBusiness",
              status: "FailedPermanent",
              retryCount: 2,
              failureReason: "The isolated browser process exited.",
              sourceEvents: [],
            },
          ],
          technicalLog: [
            {
              id: "event-1",
              kind: "DiscoveryResult",
              sourceIdentifier: "subscription-runtime-web-search",
              resultUrl: "https://example.com/result",
              message: "A public result URL was returned.",
              createdAt: "2026-08-16T10:01:00.000Z",
            },
          ],
        }),
      ),
    })
  })
  await page.goto("/runs/run-e2e")

  const warnings = page.getByText("Warnings", { exact: true })
  await expect(warnings).toBeVisible()
  await expect(warnings).toHaveAttribute("title", "Completed with Warnings")
  await expect(page.locator('[data-slot="badge"]')).toHaveCount(0)
  await expect(page.getByText("The isolated browser process exited.")).toBeVisible()

  // The log lives in a panel so it cannot lengthen the page; it has to be opened to be read.
  await expect(page.getByRole("heading", { name: "Technical Run Log" })).toBeHidden()
  await page.getByRole("button", { name: /Technical Log/ }).click()
  await expect(page.getByRole("heading", { name: "Technical Run Log" })).toBeVisible()
  // The source is a chip on the timeline row now, so it carries the identifier without a prefix.
  await expect(page.getByText("subscription-runtime-web-search")).toBeVisible()
  await expect(page.getByRole("link", { name: "Result URL" })).toHaveAttribute(
    "href",
    "https://example.com/result",
  )
  await expect(page.locator("body")).not.toContainText("chain-of-thought")
})

test("scrolls the complete run detail page instead of trapping the table", async ({ page }) => {
  await page.route("**/api/runs/run-e2e", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      // Far more businesses and events than fit on screen, which must lengthen the page scroller.
      body: JSON.stringify(
        runDetail({
          state: "Running",
          businesses: Array.from({ length: 40 }, (_, index) => ({
            id: `business-${index}`,
            currentStage: "InspectBusiness",
            status: "InProgress",
            retryCount: 0,
            sourceEvents: [],
          })),
          technicalLog: Array.from({ length: 200 }, (_, index) => ({
            id: `event-${index}`,
            kind: "DiscoveryResult",
            sourceIdentifier: "subscription-runtime-web-search",
            message: `Event ${index}`,
            createdAt: "2026-08-16T10:01:00.000Z",
          })),
        }),
      ),
    })
  })
  await page.goto("/runs/run-e2e")
  await expect(page.getByRole("heading", { name: "Run Progress" })).toBeVisible()

  await expectTablesDoNotScrollVertically(page)
  await expectPageScroll(page, 240)
})
