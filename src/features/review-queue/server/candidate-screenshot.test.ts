import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import Database from "better-sqlite3"
import { afterEach, describe, expect, it } from "vitest"

import { readCandidateScreenshot } from "@/features/review-queue/server/candidate-screenshot"

const directories: string[] = []

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe("candidate screenshots", () => {
  it("reads an owned screenshot from inside the configured artifacts directory", async () => {
    const fixture = createFixture()
    const path = join(fixture.artifactsPath, "capture.png")
    writeFileSync(path, "image")
    seedArtifact(fixture.databasePath, path, 5)

    await expect(
      readCandidateScreenshot(fixture.databasePath, fixture.artifactsPath, "score", "artifact"),
    ).resolves.toMatchObject({ mimeType: "image/png", body: Buffer.from("image") })
  })

  it("refuses an owned database path that escapes the configured artifacts directory", async () => {
    const fixture = createFixture()
    const path = join(fixture.directory, "outside.png")
    writeFileSync(path, "image")
    seedArtifact(fixture.databasePath, path, 5)

    await expect(
      readCandidateScreenshot(fixture.databasePath, fixture.artifactsPath, "score", "artifact"),
    ).resolves.toBeUndefined()
  })
})

function createFixture() {
  const directory = mkdtempSync(join(tmpdir(), "prospector-screenshot-"))
  directories.push(directory)
  const artifactsPath = join(directory, "artifacts")
  const databasePath = join(directory, "workspace.sqlite")
  mkdirSync(artifactsPath)
  const database = new Database(databasePath)
  try {
    database.exec(`
      create table candidate_scores (id text primary key, assessment_id text not null);
      create table website_assessments (id text primary key, inspection_id text not null);
      create table inspection_artifacts (
        id text primary key, inspection_id text not null, kind text not null, path text not null,
        mime_type text not null, byte_size integer not null
      );
      insert into candidate_scores values ('score','assessment');
      insert into website_assessments values ('assessment','inspection');
    `)
  } finally {
    database.close()
  }
  return { directory, artifactsPath, databasePath }
}

function seedArtifact(databasePath: string, path: string, bytes: number): void {
  const database = new Database(databasePath)
  try {
    database
      .prepare(
        "insert into inspection_artifacts values ('artifact','inspection','Screenshot',?,'image/png',?)",
      )
      .run(path, bytes)
  } finally {
    database.close()
  }
}
