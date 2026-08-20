import { expect, test } from "@playwright/test"

test("reports workspace storage and suppressed businesses", async ({ page }) => {
  await page.goto("/settings/data")

  await expect(page.getByRole("heading", { name: "Workspace Storage" })).toBeVisible()
  for (const label of [
    "Prospecting Runs",
    "Discovered Businesses",
    "Qualified Candidates",
    "Decisions Recorded",
    "Technical Events",
    "Suppressions",
  ]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible()
  }
  await expect(page.getByText("SQLite Database", { exact: true })).toBeVisible()
  await expect(page.getByText("Assessment Artifacts", { exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Suppressed Businesses" })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

test("downloads an application backup from Maintenance", async ({ page, isMobile }) => {
  test.skip(isMobile, "The same server-side archive is covered once")
  await page.goto("/settings/maintenance")

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("link", { name: "Download Backup" }).first().click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(
    /^open-local-prospector-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.olp-backup\.tgz$/u,
  )
})

test("requires explicit confirmation for restore and reset", async ({ page }) => {
  await page.goto("/settings/maintenance")

  await page.getByRole("button", { name: "Restore Backup" }).click()
  const restoreDialog = page.getByRole("dialog", { name: "Restore Workspace" })
  await expect(restoreDialog.getByLabel("Workspace Backup")).toBeVisible()
  await expect(restoreDialog.getByRole("button", { name: "Restore Workspace" })).toBeDisabled()
  await restoreDialog.getByRole("button", { name: "Cancel" }).click()

  await page.getByRole("button", { name: "Reset Workspace" }).click()
  const resetDialog = page.getByRole("alertdialog", { name: "Reset Workspace" })
  await expect(resetDialog.getByRole("link", { name: "Download A Workspace Backup" })).toBeVisible()
  const reset = resetDialog.getByRole("button", { name: "Reset Workspace" })
  await expect(reset).toBeDisabled()
  await resetDialog.getByLabel("Type RESET To Confirm").fill("RESET")
  await expect(reset).toBeEnabled()
  await resetDialog.getByRole("button", { name: "Cancel" }).click()
})
