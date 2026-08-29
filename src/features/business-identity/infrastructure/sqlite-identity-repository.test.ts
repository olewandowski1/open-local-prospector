import Database from "better-sqlite3"
import { Effect } from "effect"
import { afterEach, describe, expect, it } from "vitest"

import { evaluateBusinessIdentity } from "@/features/business-identity/domain/business-identity"
import { makeSqliteIdentityRepository } from "@/features/business-identity/infrastructure/sqlite-identity-repository"
import type { SearchBrief } from "@/features/prospecting-runs"
import { createMigratedTestDatabase } from "@/test-support/local-database"
import { createTestProspectingRun } from "@/test-support/prospecting-run"

const databases: ReturnType<typeof createMigratedTestDatabase>[] = []
afterEach(() => {
  for (const database of databases.splice(0)) database.cleanup()
})

const collectedAt = new Date("2026-08-29T10:00:00.000Z")

describe("SQLite identity repository", () => {
  // The same garage keyed on whichever telephone a run listed first, so it became two businesses.
  it("recognises a business already known by one of its routes", async () => {
    const { repository, brief, runId, databasePath } = await workspace()

    const first = await commit(repository, databasePath, runId, brief, "one", {
      name: "AUTO TYTAN",
      telephones: ["(+48) 602 764 645"],
      websiteUrl: "https://autotytan.pl/",
    })
    const second = await commit(repository, databasePath, runId, brief, "two", {
      name: "Auto Tytan Rumia",
      telephones: ["(+48) 604 421 023", "602 764 645"],
      websiteUrl: "https://autotytan.pl/kontakt/",
    })

    expect(second.canonicalBusinessId).toBe(first.canonicalBusinessId)
    expect(countCanonical(databasePath)).toBe(1)
  })

  it("recognises a business by its website when this run captured no telephone", async () => {
    const { repository, brief, runId, databasePath } = await workspace()

    const first = await commit(repository, databasePath, runId, brief, "one", {
      name: "Jimmy Serwis",
      telephones: ["882 422 841"],
      websiteUrl: "https://jimmyserwis.pl/",
    })
    const second = await commit(repository, databasePath, runId, brief, "two", {
      name: "Jimmy Serwis Dariusz Dzimira",
      telephones: [],
      email: "kontakt@jimmyserwis.pl",
      websiteUrl: "https://www.jimmyserwis.pl/kontakt",
    })

    expect(second.canonicalBusinessId).toBe(first.canonicalBusinessId)
    expect(countCanonical(databasePath)).toBe(1)
  })

  it("keeps two businesses apart when they share no route", async () => {
    const { repository, brief, runId, databasePath } = await workspace()

    await commit(repository, databasePath, runId, brief, "one", {
      name: "Auto Serwis Alldecar",
      telephones: ["535 515 515"],
      websiteUrl: "https://alldecar.pl/",
    })
    await commit(repository, databasePath, runId, brief, "two", {
      name: "Auto Serwis Marek Kranczkowski",
      telephones: ["606 676 369"],
      websiteUrl: "https://kranczkowski.pl/",
    })

    expect(countCanonical(databasePath)).toBe(2)
  })
})

async function workspace() {
  const database = createMigratedTestDatabase()
  databases.push(database)
  const run = await createTestProspectingRun(database.path, "identity-run", {
    location: "Rumia",
    category: "Car repair garages",
  })
  const brief = JSON.parse(
    readValue(database.path, "select search_brief from prospecting_runs where id = ?", run.id),
  ) as SearchBrief
  return {
    repository: makeSqliteIdentityRepository(database.path),
    brief,
    runId: run.id,
    databasePath: database.path,
  }
}

async function commit(
  repository: ReturnType<typeof makeSqliteIdentityRepository>,
  databasePath: string,
  runId: string,
  brief: SearchBrief,
  suffix: string,
  input: {
    name: string
    telephones: readonly string[]
    email?: string
    websiteUrl: string
  },
) {
  const discoveredBusinessId = `discovered-${suffix}`
  insertDiscovered(databasePath, runId, discoveredBusinessId, input.name)
  const evaluation = evaluateBusinessIdentity({
    business: {
      name: input.name,
      locality: "Rumia",
      decisionScope: "Local",
      centrallyControlled: false,
      onlineOnly: false,
      sourceUrls: [input.websiteUrl, `${input.websiteUrl}#again`],
      presences: [{ type: "Website", url: input.websiteUrl }],
      contacts: [
        ...input.telephones.map((value) => ({
          type: "BusinessTelephone" as const,
          value,
          sourceUrl: input.websiteUrl,
        })),
        ...(input.email
          ? [{ type: "GenericEmail" as const, value: input.email, sourceUrl: input.websiteUrl }]
          : []),
      ],
    },
    countryCode: "PL",
    collectedAt,
  })
  return Effect.runPromise(
    repository.commitEvaluation({
      runId,
      taskId: planningTaskId(databasePath, runId),
      discoveredBusinessId,
      searchBrief: brief,
      evaluation,
      committedAt: collectedAt,
    }),
  )
}

function insertDiscovered(databasePath: string, runId: string, id: string, name: string): void {
  const database = new Database(databasePath)
  try {
    database
      .prepare(
        `insert into discovered_businesses
         (id, run_id, source, source_identifier, discovery_key, name, normalized_name, result_url,
          raw_attributes, discovered_at, discovery_rank)
         values (?, ?, 'test', ?, ?, ?, ?, 'https://example.test/', '{}', ?, 1)`,
      )
      .run(id, runId, id, id, name, name.toLowerCase(), collectedAt.getTime())
  } finally {
    database.close()
  }
}

function planningTaskId(databasePath: string, runId: string): string {
  const database = new Database(databasePath, { readonly: true })
  try {
    return database
      .prepare("select id from run_tasks where run_id = ? order by created_at limit 1")
      .pluck()
      .get(runId) as string
  } finally {
    database.close()
  }
}

function countCanonical(databasePath: string): number {
  const database = new Database(databasePath, { readonly: true })
  try {
    return Number(database.prepare("select count(*) from canonical_businesses").pluck().get())
  } finally {
    database.close()
  }
}

function readValue(databasePath: string, query: string, parameter: string): string {
  const database = new Database(databasePath, { readonly: true })
  try {
    return database.prepare(query).pluck().get(parameter) as string
  } finally {
    database.close()
  }
}
