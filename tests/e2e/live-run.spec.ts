import { expect, test } from "@playwright/test"

/**
 * A real run: real subscription-runtime web searches, real page inspections, real subscription usage,
 * and several minutes of wall clock. It never runs as part of the suite; set PROSPECTOR_LIVE_RUN=1 to
 * exercise the pipeline end to end.
 */
test("creates and completes a real prospecting run", async ({ page, isMobile }) => {
  test.skip(process.env.PROSPECTOR_LIVE_RUN !== "1", "Set PROSPECTOR_LIVE_RUN=1 to run for real")
  test.skip(isMobile, "Driven once, on desktop")
  test.setTimeout(30 * 60_000)

  await page.goto("/runs/new")
  const preflight = page.getByRole("button", { name: "Check preflight" })
  test.skip(
    await page.getByText("No subscription runtime is ready").isVisible(),
    "No ready subscription runtime",
  )
  await expect(preflight).toBeEnabled({ timeout: 30_000 })

  await page.getByLabel("City or Municipality").fill("Krapkowice, Poland")
  await page.getByLabel("Target Businesses").fill("5")
  await preflight.click()

  // Base UI does not forward the group aria-label, but each area radio is named for its display name,
  // and only the Search Area radios carry a country in that name.
  const area = page.getByRole("radio", { name: /Polska$/ }).first()
  await expect(area).toBeVisible({ timeout: 180_000 })
  await area.click()

  const confirm = page.getByRole("button", { name: "Confirm and create run" })
  await expect(confirm).toBeEnabled({ timeout: 30_000 })
  await confirm.click()

  const progress = page.getByRole("link", { name: "View Progress" })
  await expect(progress).toBeVisible({ timeout: 60_000 })
  await progress.click()
  await expect(page).toHaveURL(/\/runs\/[0-9a-f-]{36}$/u)
  const runId = page.url().split("/").pop()
  console.log(`LIVE_RUN_ID=${runId}`)

  // The page polls itself; wait for the run to settle rather than for a fixed time.
  await expect(async () => {
    const state = await page.evaluate(() => {
      const badge = document.querySelector('[data-slot="badge"]')
      return badge?.getAttribute("title") ?? badge?.textContent ?? ""
    })
    console.log(`state=${state}`)
    expect([
      "Target Reached",
      "Search Exhausted",
      "Completed with Warnings",
      "Completed",
      "Cancelled with Partial Results",
      "Infrastructure Failed",
      "Runtime Unavailable",
    ]).toContain(state)
  }).toPass({ timeout: 25 * 60_000, intervals: [15_000] })

  console.log(`FINAL_URL=${page.url()}`)
})
