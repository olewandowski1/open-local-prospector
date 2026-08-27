import { expect, test } from "@playwright/test"

/** Opt-in test that spends subscription usage on a complete live run. */
test("creates and completes a real prospecting run", async ({ page, isMobile }) => {
  test.skip(process.env.PROSPECTOR_LIVE_RUN !== "1", "Set PROSPECTOR_LIVE_RUN=1 to run for real")
  test.skip(isMobile, "Driven once, on desktop")
  test.setTimeout(30 * 60_000)

  await page.goto("/runs")
  await page.getByRole("button", { name: "New Run" }).click()
  const preflight = page.getByRole("button", { name: "Check Preflight" })
  // The sheet loads its bootstrap before the brief appears.
  await expect(preflight).toBeVisible({ timeout: 30_000 })
  test.skip(
    await page.getByText("No subscription runtime is ready").isVisible(),
    "No ready subscription runtime",
  )
  await expect(preflight).toBeEnabled({ timeout: 30_000 })

  await page
    .getByLabel("City or Municipality")
    .fill(process.env.PROSPECTOR_LIVE_LOCATION ?? "Krapkowice, Poland")
  await page.getByLabel("Target Businesses").fill(process.env.PROSPECTOR_LIVE_TARGET ?? "5")
  await preflight.click()

  // Search Area radios are the only options whose names include a country.
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

  // Wait on the polled semantic status instead of using a fixed delay.
  await expect(async () => {
    const state = await page.evaluate(() => {
      const label = [...document.querySelectorAll("dl")].find(
        (row) => row.querySelector("dt")?.textContent?.trim() === "Status",
      )
      const value = label?.querySelector("dd span")
      return value?.getAttribute("title") ?? value?.textContent?.trim() ?? ""
    })
    console.log(`state=${state}`)
    expect([
      "Target Reached",
      "Search Exhausted",
      "Completed with Warnings",
      "Completed",
    ]).toContain(state)
  }).toPass({ timeout: 25 * 60_000, intervals: [15_000] })

  console.log(`FINAL_URL=${page.url()}`)
})
