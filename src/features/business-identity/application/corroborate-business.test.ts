import Database from "better-sqlite3"
import { Effect } from "effect"
import { afterEach, describe, expect, it } from "vitest"

import type { StructuredBusiness } from "@/features/business-discovery"
import { makeSqliteDiscoveryRepository } from "@/features/business-discovery"
import { makeIdentityTaskExecutor } from "@/features/business-identity/application/corroborate-business"
import { makeSqliteIdentityRepository } from "@/features/business-identity/infrastructure/sqlite-identity-repository"
import type { SearchBrief } from "@/features/prospecting-runs"
import type { RunTask } from "@/features/run-execution"
import { createMigratedTestDatabase } from "@/test-support/local-database"
import { createTestProspectingRun } from "@/test-support/prospecting-run"

const databases: ReturnType<typeof createMigratedTestDatabase>[] = []
afterEach(() => {
  for (const database of databases.splice(0)) database.cleanup()
})

describe("business identity workflow", () => {
  it("persists the verified presence and Contact Routes before scheduling inspection", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const task = await seedIdentityTask(database.path, "identity-eligible", business())

    const checkpoint = await Effect.runPromise(
      makeIdentityTaskExecutor(makeSqliteIdentityRepository(database.path))(task),
    )

    expect(checkpoint).toMatchObject({ value: { status: "Eligible", contactRoutes: 1 } })
    expect(checkpoint.nextTasks).toEqual([
      expect.objectContaining({ stage: "InspectWebsite", businessId: task.businessId }),
    ])
    expect(readScalar(database.path, "select count(*) from contact_routes")).toBe(1)
    expect(readScalar(database.path, "select count(*) from online_presences")).toBe(1)
  })

  it("reuses one canonical identity across runs keyed on the telephone", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const execute = makeIdentityTaskExecutor(makeSqliteIdentityRepository(database.path))

    for (const requestId of ["identity-run-one", "identity-run-two"]) {
      const task = await seedIdentityTask(database.path, requestId, business())
      await Effect.runPromise(execute(task))
    }

    expect(readScalar(database.path, "select count(*) from canonical_businesses")).toBe(1)
    expect(readScalar(database.path, "select count(*) from run_businesses")).toBe(2)
  })

  // Sharing neither a telephone nor a site, these are neighbours rather than one business twice.
  it("keeps same-name businesses distinct when they share no route", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const execute = makeIdentityTaskExecutor(makeSqliteIdentityRepository(database.path))

    await Effect.runPromise(
      execute(await seedIdentityTask(database.path, "phone-one", business("+48123456789"))),
    )
    await Effect.runPromise(
      execute(
        await seedIdentityTask(
          database.path,
          "phone-two",
          business("+48222333444", "https://usmiech-reda.pl/"),
        ),
      ),
    )

    expect(readScalar(database.path, "select count(*) from canonical_businesses")).toBe(2)
    expect(
      readScalar(database.path, "select count(distinct canonical_business_id) from run_businesses"),
    ).toBe(2)
  })

  // One garage listing its two numbers in a different order had become two businesses.
  it("recognises a business by a route it shares, though the telephone differs", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const execute = makeIdentityTaskExecutor(makeSqliteIdentityRepository(database.path))

    await Effect.runPromise(
      execute(await seedIdentityTask(database.path, "route-one", business("+48123456789"))),
    )
    await Effect.runPromise(
      execute(await seedIdentityTask(database.path, "route-two", business("+48222333444"))),
    )

    expect(readScalar(database.path, "select count(*) from canonical_businesses")).toBe(1)
  })

  it("excludes a centrally controlled outlet without scheduling inspection", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const task = await seedIdentityTask(database.path, "identity-chain", {
      ...business(),
      centrallyControlled: true,
    })

    const checkpoint = await Effect.runPromise(
      makeIdentityTaskExecutor(makeSqliteIdentityRepository(database.path))(task),
    )

    expect(checkpoint.value.status).toBe("Excluded")
    expect(checkpoint.nextTasks).toBeUndefined()
  })

  it("refuses a business discovered before structured attribution existed", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const task = await seedIdentityTask(database.path, "identity-legacy", business())
    withDatabase(database.path, (sqlite) =>
      sqlite.prepare("update discovered_businesses set structured = null").run(),
    )

    const failure = await Effect.runPromise(
      Effect.flip(makeIdentityTaskExecutor(makeSqliteIdentityRepository(database.path))(task)),
    )

    expect(failure.code).toBe("missing-structured-business")
  })
})

function business(telephone = "+48123456789", site = "https://usmiech.pl/"): StructuredBusiness {
  return {
    name: "Gabinet Uśmiech",
    locality: "Kraków",
    decisionScope: "Local",
    centrallyControlled: false,
    onlineOnly: false,
    websiteUrl: site,
    sourceUrls: [site],
    presences: [{ type: "Website", url: site }],
    contacts: [{ type: "BusinessTelephone", value: telephone, sourceUrl: site }],
  }
}

async function seedIdentityTask(
  databasePath: string,
  requestId: string,
  structured: StructuredBusiness,
  overrides: Partial<SearchBrief> = {},
): Promise<RunTask> {
  const run = await createTestProspectingRun(databasePath, requestId, overrides)
  const taskId = withDatabase(databasePath, (database) =>
    String(database.prepare("select id from run_tasks where run_id = ?").pluck().get(run.id)),
  )
  await Effect.runPromise(
    makeSqliteDiscoveryRepository(databasePath).recordReport({
      runId: run.id,
      taskId,
      source: "fixture-discovery",
      query: `seed ${requestId}`,
      report: `${structured.name}\n  https://usmiech.pl/\n  tel. ${structured.contacts[0]?.value ?? ""}`,
      runtimeId: "claude",
      returned: 1,
      businesses: [structured],
      rejections: [],
      recordedAt: new Date(),
    }),
  )
  const businessId = withDatabase(databasePath, (database) =>
    String(
      database
        .prepare(
          "select id from discovered_businesses where run_id = ? order by discovery_rank desc limit 1",
        )
        .pluck()
        .get(run.id),
    ),
  )
  return {
    id: taskId,
    runId: run.id,
    businessId,
    stage: "CorroborateBusiness",
    status: "Leased",
    attemptCount: 1,
    maxAttempts: 3,
    input: { businessId },
    schemaVersion: 1,
    version: 1,
  }
}

function readScalar(databasePath: string, query: string): number {
  return Number(withDatabase(databasePath, (database) => database.prepare(query).pluck().get()))
}

function withDatabase<A>(databasePath: string, use: (database: Database.Database) => A): A {
  const database = new Database(databasePath, { fileMustExist: true })
  try {
    return use(database)
  } finally {
    database.close()
  }
}
