import { expect, test } from "@playwright/test"

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
  await expect(page.getByText("Cancelled with Partial Results", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Cancel" })).toBeDisabled()
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

  await expect(page.getByText("Completed with Warnings", { exact: true })).toBeVisible()
  await expect(page.getByText("The isolated browser process exited.")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Technical Run Log" })).toBeVisible()
  await expect(page.getByText("Source: subscription-runtime-web-search")).toBeVisible()
  await expect(page.getByRole("link", { name: "Result URL" })).toHaveAttribute(
    "href",
    "https://example.com/result",
  )
  await expect(page.locator("body")).not.toContainText("chain-of-thought")
})
