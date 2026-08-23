import { expect, test } from "@playwright/test"

const enabled = process.env.PROSPECTOR_RUNTIME_COMPARISON === "1"
const runtimes = ["Codex", "Claude", "OpenCode"] as const

test.describe.configure({ mode: "serial" })

for (const runtime of runtimes) {
  for (const repetition of [1, 2]) {
    test(`${runtime} repetition ${repetition}`, async ({ page }) => {
      test.skip(!enabled, "Set PROSPECTOR_RUNTIME_COMPARISON=1 to use real subscription runtimes")
      test.setTimeout(runtime === "OpenCode" ? 55 * 60_000 : 30 * 60_000)

      await page.goto("/runs/new")
      await page.getByLabel("City or Municipality").fill("Reda, Poland")
      await page.getByLabel("Target Businesses").fill("5")
      await page.getByRole("combobox", { name: "Business category" }).click()
      await page.getByRole("option", { name: "Beauty salons" }).click()
      await page.locator('[data-slot="radio-group-item"][aria-label="Quick"]').click()
      await page.getByRole("combobox", { name: "Recently Assessed Businesses" }).click()
      await page.getByRole("option", { name: "Explicitly reassess" }).click()
      await page.getByRole("combobox", { name: "Subscription Runtime" }).click()
      await page.getByRole("option", { name: runtime }).click()
      await page.getByRole("button", { name: "Check preflight" }).click()

      const area = page
        .locator('[role="radiogroup"][aria-label="Search Area"] [role="radio"]')
        .first()
      await expect(area).toBeVisible({ timeout: 180_000 })
      await area.click()
      const confirm = page.getByRole("button", { name: "Confirm and create run" })
      await expect(confirm).toBeEnabled()
      await confirm.click()

      const progress = page.getByRole("link", { name: "View Progress" })
      await expect(progress).toBeVisible({ timeout: 60_000 })
      const runId = (await progress.getAttribute("href"))?.split("/").pop()
      await progress.click()

      await expect(async () => {
        const state = await page.evaluate(() => {
          const row = [...document.querySelectorAll("dl")].find(
            (item) => item.querySelector("dt")?.textContent?.trim() === "Status",
          )
          const value = row?.querySelector("dd span")
          return value?.getAttribute("title") ?? value?.textContent?.trim() ?? ""
        })
        expect([
          "Target Reached",
          "Search Exhausted",
          "Completed with Warnings",
          "Completed",
          "Cancelled with Partial Results",
          "Infrastructure Failed",
          "Runtime Unavailable",
        ]).toContain(state)
      }).toPass({
        timeout: runtime === "OpenCode" ? 50 * 60_000 : 25 * 60_000,
        intervals: [15_000],
      })

      console.log(`RUNTIME_COMPARISON=${runtime},${repetition},${runId ?? "unknown"}`)
    })
  }
}
