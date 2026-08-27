import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect } from "effect"

import { makePlaywrightWebsiteInspector } from "@/features/website-inspection/worker"

// Runs under the worker's own loader, where a transpiler helper leaking into the page is observable.
const FIXTURE_URL = "https://inspection-check.test/"

async function main(): Promise<void> {
  const artifactDirectory = mkdtempSync(join(tmpdir(), "prospector-inspection-check-"))
  try {
    const result = await Effect.runPromise(
      makePlaywrightWebsiteInspector({
        resolveHost: async () => ["93.184.216.34"],
        fixtureResponses: {
          [FIXTURE_URL]: {
            body: '<!doctype html><html lang="pl"><head><title>Kontrola</title></head><body><h1>Kontrola</h1><a href="/kontakt">Kontakt</a></body></html>',
          },
          [`${FIXTURE_URL}kontakt`]: {
            body: '<!doctype html><html lang="pl"><head><title>Kontakt</title></head><body><form method="post"><input type="email"><button>Wyślij</button></form></body></html>',
          },
        },
      }).inspect({ url: FIXTURE_URL, artifactDirectory }),
    )
    const failures = [
      result.status === "Complete" ? "" : `status was ${result.status}, expected Complete`,
      result.pages.length === 4 ? "" : `captured ${result.pages.length} pages, expected 4`,
      result.pages.every((page) => page.title.length > 0)
        ? ""
        : "a captured page reported no title, so page facts were not extracted",
      result.blocks.length === 0
        ? ""
        : `recorded blocks ${result.blocks.map((block) => block.code).join(", ")}`,
    ].filter(Boolean)
    if (failures.length > 0) {
      console.error(`Inspection check failed: ${failures.join("; ")}`)
      process.exitCode = 1
      return
    }
    console.log(`Inspection check captured ${result.pages.length} pages with page facts extracted`)
  } finally {
    rmSync(artifactDirectory, { force: true, recursive: true })
  }
}

await main()
