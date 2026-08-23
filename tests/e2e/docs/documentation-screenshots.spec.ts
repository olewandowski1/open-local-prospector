import { resolve } from "node:path"

import { expect, test } from "@playwright/test"

const assets = resolve("docs/assets")

test("captures the product with synthetic fixture data", async ({ page }) => {
  await page.goto("/")
  await page.waitForLoadState("networkidle")
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator("html")).toHaveClass(/dark/)
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible()
  await expect(page.getByText("Amber Bloom Florist", { exact: true })).toBeVisible()
  await expect(page.getByText("Reda", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Rumia", { exact: true }).first()).toBeVisible()
  await page.screenshot({
    path: resolve(assets, "overview.png"),
    animations: "disabled",
  })

  await page.goto("/review")
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "Open For Review" }).first().click()
  await expect(page.getByRole("heading", { name: "Notes And Follow-Up" })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({
    path: resolve(assets, "candidate-review.png"),
    animations: "disabled",
  })
})
