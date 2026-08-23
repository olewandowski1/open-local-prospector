import { resolve } from "node:path"
import Database from "better-sqlite3"
import { Effect, Option } from "effect"

import { makeSubscriptionDiscoveryRuntime } from "@/features/business-discovery/worker"
import { resolveRuntimeExecutable } from "@/features/runtime-settings"

const database = new Database(resolve(".scratch/live-e2e/workspace.sqlite"), { readonly: true })

try {
  const row = database
    .prepare("select report_text as report from discovery_reports order by created_at limit 1")
    .get() as { report: string } | undefined
  if (!row) throw new Error("The live comparison workspace has no discovery report.")

  const executable = await Effect.runPromise(resolveRuntimeExecutable("codex"))
  if (Option.isNone(executable)) throw new Error("Codex is not installed.")

  const runtime = makeSubscriptionDiscoveryRuntime({ codex: executable.value })
  const structured = await Effect.runPromise(
    runtime.structure(
      {
        runtime: "codex",
        runtimeConfiguration: { model: "gpt-5.6-luna", reasoningEffort: "max" },
        query: "beauty salons in Reda",
        category: "Beauty salons",
        searchAreaName: "Reda, Poland",
        countryCode: "PL",
        searchLanguage: "Polish",
        wanted: 5,
      },
      row.report,
    ),
  )
  console.log(`CODEX_STRUCTURE_BUSINESSES=${structured.businesses.length}`)
} finally {
  database.close()
}
