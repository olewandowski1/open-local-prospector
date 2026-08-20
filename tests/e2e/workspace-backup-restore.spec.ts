import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

import { expect, test } from "@playwright/test"
import Database from "better-sqlite3"

import { migrateLocalDatabase } from "../../src/features/local-application/infrastructure/database/local-database"

const root = resolve(".scratch/workspace-e2e")
const databasePath = resolve(root, "workspace.sqlite")
const artifactsPath = resolve(root, "artifacts")
const evidencePath = resolve(artifactsPath, "seed-evidence.txt")
const orphanPath = resolve(artifactsPath, "orphan-after-delete.txt")

test.skip(
  process.env.PROSPECTOR_ISOLATED_WORKSPACE_TEST !== "1",
  "Destructive round-trip runs only in the isolated workspace harness.",
)

test.beforeAll(() => {
  const workspaceRoot = resolve(root)
  const scratchRoot = `${resolve(".scratch")}\\`
  if (!`${workspaceRoot}\\`.startsWith(scratchRoot)) throw new Error("Unsafe E2E workspace path.")
  rmSync(workspaceRoot, { recursive: true, force: true })
  mkdirSync(artifactsPath, { recursive: true })
  migrateLocalDatabase(databasePath)
  const database = new Database(databasePath)
  try {
    database
      .prepare(
        "insert into prospecting_runs (id,request_id,state,search_brief,created_at,updated_at) values ('restore-run','restore-request','Completed',?,1,1)",
      )
      .run(JSON.stringify({ category: "Restore Proof", location: "Krakow", targetCount: 5 }))
    database.exec(`
      insert into canonical_businesses (id,identity_fingerprint,name,normalized_name,locality,country_code,decision_scope,created_at,updated_at)
      values ('delete-business','delete-fingerprint','Delete Me Bakery','delete me bakery','Krakow','PL','Local',1,1);
      insert into discovered_businesses (id,run_id,source,source_identifier,discovery_key,name,normalized_name,result_url,raw_attributes,discovered_at)
      values ('delete-discovery','restore-run','Search','delete-source','delete-key','Delete Me Bakery','delete me bakery','https://example.com','{}',1);
      insert into run_businesses (id,run_id,discovered_business_id,canonical_business_id,status,identity_confidence,signals,created_at,updated_at)
      values ('delete-run-business','restore-run','delete-discovery','delete-business','Candidate','Corroborated','[]',1,1);
      insert into run_tasks (id,run_id,business_id,stage,status,created_at,updated_at)
      values ('inspection-task','restore-run','delete-run-business','InspectWebsite','Completed',1,1),
             ('assessment-task','restore-run','delete-run-business','AssessWebsiteOpportunity','Completed',1,1),
             ('score-task','restore-run','delete-run-business','ScoreCandidate','Completed',1,1);
      insert into website_inspections (id,run_id,task_id,run_business_id,canonical_business_id,status,configuration_version,started_at,completed_at)
      values ('delete-inspection','restore-run','inspection-task','delete-run-business','delete-business','Completed','v1',1,1);
      insert into website_assessments (id,run_id,task_id,run_business_id,canonical_business_id,inspection_id,runtime_id,prompt_version,output_schema_version,inspection_configuration_version,assessment_state,summary,apparent_commercial_value,assessed_at)
      values ('delete-assessment','restore-run','assessment-task','delete-run-business','delete-business','delete-inspection','codex','v1','v1','v1','Assessed','Useful business',1,1);
      insert into website_opportunities (id,assessment_id,opportunity_class,severity,confidence,observable_effect,explanation,sequence)
      values ('delete-opportunity','delete-assessment','Conversion',3,0.9,'Missed enquiries','Contact flow can improve',0);
      insert into inspection_pages (id,inspection_id,sequence,viewport,requested_url,final_url,title,rendered_text,links,forms,console_failures,network_failures,measurements,captured_at)
      values ('delete-page','delete-inspection',0,'Desktop','https://example.com','https://example.com','Bakery','Bakery page','[]','[]','[]','[]','{}',1);
      insert into candidate_scores (id,run_id,task_id,run_business_id,canonical_business_id,assessment_id,rubric_version,severity_component,confidence_component,contact_component,local_decision_component,commercial_value_component,total,qualified,scored_at)
      values ('delete-score','restore-run','score-task','delete-run-business','delete-business','delete-assessment','v1',3,2,1,1,1,8,1,1);
      insert into candidate_reviews (id,score_id,status,private_notes,updated_at)
      values ('delete-review','delete-score','Unreviewed','private note',1);
      insert into inspection_artifacts (id,inspection_id,page_id,kind,viewport,path,mime_type,byte_size,sha256,created_at)
      values ('delete-artifact','delete-inspection','delete-page','Screenshot','Desktop','${evidencePath.replaceAll("'", "''")}','text/plain',19,'hash',1);
    `)
  } finally {
    database.close()
  }
  writeFileSync(evidencePath, "restorable evidence", "utf8")
})

test.afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

test("downloads, resets and restores the complete workspace through the UI", async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto("/settings/data")
  await expect(statFor(page, "Prospecting Runs")).toHaveText("1")
  await expect(page.getByText("1 Files · 19 B", { exact: true })).toBeVisible()

  await page.goto("/settings/maintenance")
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("link", { name: "Download Backup" }).first().click()
  const download = await downloadPromise
  const backupPath = resolve(root, "round-trip.olp-backup.tgz")
  await download.saveAs(backupPath)
  expect(existsSync(backupPath)).toBe(true)

  await page.getByRole("button", { name: "Reset Workspace" }).click()
  const resetDialog = page.getByRole("alertdialog", { name: "Reset Workspace" })
  await resetDialog.getByLabel("Type RESET To Confirm").fill("RESET")
  await resetDialog.getByRole("button", { name: "Reset Workspace" }).click()
  await expect(page.getByText("Workspace Reset")).toBeVisible()
  await page.goto("/settings/data")
  await expect(statFor(page, "Prospecting Runs")).toHaveText("0")
  expect(existsSync(evidencePath)).toBe(false)

  await page.goto("/settings/maintenance")
  await page.getByRole("button", { name: "Restore Backup" }).click()
  const restoreDialog = page.getByRole("dialog", { name: "Restore Workspace" })
  await restoreDialog.getByLabel("Workspace Backup").setInputFiles(backupPath)
  await restoreDialog.getByLabel("Type RESTORE To Confirm").fill("RESTORE")
  await restoreDialog.getByRole("button", { name: "Restore Workspace" }).click()
  await expect(page.getByText("Workspace Restored")).toBeVisible({ timeout: 30_000 })
  await page.goto("/settings/data")
  await expect(statFor(page, "Prospecting Runs")).toHaveText("1")
  expect(readFileSync(evidencePath, "utf8")).toBe("restorable evidence")

  await page.goto("/review")
  await page.getByRole("button", { name: "Open For Review" }).click()
  await page.getByRole("button", { name: "Delete Business", exact: true }).click()
  const deleteDialog = page.getByRole("alertdialog", { name: "Delete Delete Me Bakery" })
  await deleteDialog.getByLabel("Type DELETE To Confirm").fill("DELETE")
  await deleteDialog.getByRole("button", { name: "Delete Business" }).click()
  await expect(page.getByRole("button", { name: "Open For Review" })).toHaveCount(0)
  expect(existsSync(evidencePath)).toBe(false)

  writeFileSync(orphanPath, "orphan", "utf8")
  await page.goto("/settings/maintenance")
  await page.getByRole("button", { name: "Clean Up", exact: true }).click()
  const cleanupDialog = page.getByRole("alertdialog", { name: "Clean Up Artifacts" })
  await cleanupDialog.getByLabel("Type CLEANUP To Confirm").fill("CLEANUP")
  await cleanupDialog.getByRole("button", { name: "Clean Up Artifacts" }).click()
  await expect(page.getByText("Artifacts Cleaned Up")).toBeVisible()
  expect(existsSync(orphanPath)).toBe(false)

  const database = new Database(databasePath, { readonly: true })
  try {
    expect(database.pragma("integrity_check", { simple: true })).toBe("ok")
    expect(
      database.prepare("select state from prospecting_runs where id='restore-run'").pluck().get(),
    ).toBe("Completed")
    expect(database.prepare("select count(*) from canonical_businesses").pluck().get()).toBe(0)
    expect(database.prepare("select count(*) from run_businesses").pluck().get()).toBe(0)
    expect(database.prepare("select count(*) from discovered_businesses").pluck().get()).toBe(0)
    expect(
      database
        .prepare("select count(*) from run_tasks where business_id='delete-run-business'")
        .pluck()
        .get(),
    ).toBe(0)
    expect(database.prepare("select count(*) from candidate_reviews").pluck().get()).toBe(0)
    expect(
      database
        .prepare(
          "select reason from suppression_entries where identity_fingerprint='delete-fingerprint'",
        )
        .pluck()
        .get(),
    ).toBe("Deleted by operator")
  } finally {
    database.close()
  }
})

function statFor(page: import("@playwright/test").Page, label: string) {
  return page.locator("dl > div").filter({ hasText: label }).locator("dd")
}
