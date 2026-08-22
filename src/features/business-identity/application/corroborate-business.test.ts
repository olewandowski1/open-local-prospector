import Database from "better-sqlite3"
import { Effect } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { DiscoverySource } from "@/features/business-discovery"
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
  it("persists corroborated presence and Contact Routes before scheduling inspection", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const task = await seedIdentityTask(database.path, "identity-correct")
    const search = evidenceSource()

    const checkpoint = await Effect.runPromise(
      makeIdentityTaskExecutor(
        { identifier: "fake-public-search", search },
        makeSqliteIdentityRepository(database.path),
      )(task),
    )

    expect(search).toHaveBeenCalledTimes(2)
    expect(checkpoint).toMatchObject({ value: { status: "Eligible", contactRoutes: 4 } })
    expect(checkpoint.nextTasks).toEqual([
      expect.objectContaining({ stage: "InspectWebsite", businessId: expect.any(String) }),
    ])
    expect(readScalar(database.path, "select count(*) from online_presences")).toBe(3)
    expect(
      readScalar(
        database.path,
        "select count(*) from online_presences where association_state = 'Ambiguous'",
      ),
    ).toBe(0)
    expect(readScalar(database.path, "select count(*) from contact_routes")).toBe(4)
    expect(readScalar(database.path, "select count(*) from identity_evidence_queries")).toBe(2)
    expect(readScalar(database.path, "select queries from run_metrics")).toBe(3)
    const route = readRow(
      database.path,
      "select type, source_url, collected_at from contact_routes where type = 'GenericEmail'",
    )
    expect(route).toMatchObject({
      type: "GenericEmail",
      source_url: "https://usmiech.pl/kontakt",
      collected_at: expect.any(Number),
    })
  })

  it("reuses one canonical identity across runs", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const execute = makeIdentityTaskExecutor(
      { identifier: "fake-public-search", search: evidenceSource() },
      makeSqliteIdentityRepository(database.path),
    )
    await Effect.runPromise(execute(await seedIdentityTask(database.path, "identity-run-a")))
    await Effect.runPromise(execute(await seedIdentityTask(database.path, "identity-run-b")))

    expect(readScalar(database.path, "select count(*) from canonical_businesses")).toBe(1)
    expect(
      readScalar(database.path, "select count(distinct canonical_business_id) from run_businesses"),
    ).toBe(1)
    expect(readScalar(database.path, "select count(*) from run_businesses")).toBe(2)
  })

  it.each([
    ["Skip", "SkippedRecent", false],
    ["IncludeWithoutReassessment", "IncludedRecent", false],
    ["Reassess", "Eligible", true],
  ] as const)(
    "applies recent-business policy %s distinctly",
    async (recentBusinessPolicy, expectedStatus, shouldInspect) => {
      const database = createMigratedTestDatabase()
      databases.push(database)
      const execute = makeIdentityTaskExecutor(
        { identifier: "fake-public-search", search: evidenceSource() },
        makeSqliteIdentityRepository(database.path),
      )
      await Effect.runPromise(execute(await seedIdentityTask(database.path, "identity-history")))
      withDatabase(database.path, (sqlite) => {
        sqlite.prepare("update canonical_businesses set last_assessed_at = ?").run(Date.now())
      })
      const checkpoint = await Effect.runPromise(
        execute(
          await seedIdentityTask(database.path, `identity-policy-${recentBusinessPolicy}`, {
            recentBusinessPolicy,
          }),
        ),
      )

      expect(checkpoint.value.status).toBe(expectedStatus)
      expect(Boolean(checkpoint.nextTasks?.length)).toBe(shouldInspect)
    },
  )

  it("persists ambiguous associations without creating a canonical identity", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const task = await seedIdentityTask(database.path, "identity-ambiguous")
    const search = vi.fn<DiscoverySource["search"]>(() =>
      Effect.succeed({
        results: [
          {
            sourceIdentifier: "fixture:directory",
            title: "Najlepsi dentyści",
            url: "https://directory.test/list",
            attributes: {},
          },
        ],
        moreResults: false,
      }),
    )
    const checkpoint = await Effect.runPromise(
      makeIdentityTaskExecutor(
        { identifier: "fake-public-search", search },
        makeSqliteIdentityRepository(database.path),
      )(task),
    )

    expect(checkpoint.value.status).toBe("Ambiguous")
    expect(checkpoint.nextTasks).toBeUndefined()
    expect(readScalar(database.path, "select count(*) from canonical_businesses")).toBe(0)
    expect(readRow(database.path, "select status, exclusion_code from run_businesses")).toEqual({
      status: "Ambiguous",
      exclusion_code: "identity-ambiguous",
    })
    expect(
      readScalar(
        database.path,
        "select count(*) from online_presences where association_state = 'Ambiguous'",
      ),
    ).toBeGreaterThan(0)
  })

  it("counts one business once when two discovered listings corroborate to it", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const first = await seedIdentityTask(database.path, "identity-duplicate")
    const second = await addDiscoveredListing(database.path, first, "Gabinet Uśmiech Kraków 24h")
    const executor = makeIdentityTaskExecutor(
      { identifier: "fake-public-search", search: evidenceSource() },
      makeSqliteIdentityRepository(database.path),
    )

    const original = await Effect.runPromise(executor(first))
    const duplicate = await Effect.runPromise(executor(second))

    expect(original).toMatchObject({ value: { status: "Eligible" } })
    expect(original.nextTasks).toHaveLength(1)
    // The same business twice must not be inspected, scored, and counted towards the target twice.
    expect(duplicate).toMatchObject({ value: { status: "DuplicateCandidate" } })
    expect(duplicate.nextTasks).toBeUndefined()
    expect(readScalar(database.path, "select count(distinct id) from canonical_businesses")).toBe(1)
    expect(
      readRow(
        database.path,
        "select status, exclusion_reason from run_businesses where status = 'DuplicateCandidate'",
      ),
    ).toMatchObject({ exclusion_reason: "Already discovered in this run under another listing." })
    expect(readScalar(database.path, "select exclusions from run_metrics")).toBe(1)
  })

  it("keeps one canonical business when a later run extracts a different telephone", async () => {
    const database = createMigratedTestDatabase()
    databases.push(database)
    const repository = makeSqliteIdentityRepository(database.path)
    const first = await seedIdentityTask(database.path, "identity-run-one")
    const second = await seedIdentityTask(database.path, "identity-run-two")

    await Effect.runPromise(
      makeIdentityTaskExecutor(
        { identifier: "fake-public-search", search: evidenceSource("12 345 67 89") },
        repository,
      )(first),
    )
    await Effect.runPromise(
      makeIdentityTaskExecutor(
        { identifier: "fake-public-search", search: evidenceSource("12 999 88 77") },
        repository,
      )(second),
    )

    // Keyed on the telephone alone, a second published number opened a second canonical business.
    expect(readScalar(database.path, "select count(*) from canonical_businesses")).toBe(1)
    expect(
      readScalar(database.path, "select count(distinct canonical_business_id) from run_businesses"),
    ).toBe(1)
  })
})

async function addDiscoveredListing(
  databasePath: string,
  task: RunTask,
  title: string,
): Promise<RunTask> {
  await Effect.runPromise(
    makeSqliteDiscoveryRepository(databasePath).recordPage({
      runId: task.runId,
      taskId: task.id,
      source: "fixture-discovery",
      query: `seed ${title}`,
      offset: 0,
      page: {
        results: [
          {
            sourceIdentifier: `fixture:${title}`,
            title,
            url: `https://directory.test/${encodeURIComponent(title)}`,
            description: "Public discovery input",
            attributes: {},
          },
        ],
        moreResults: false,
      },
      targetCount: 5,
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
        .get(task.runId),
    ),
  )
  return { ...task, businessId, input: { businessId } }
}

function evidenceSource(telephone = "12 345 67 89") {
  return vi.fn<DiscoverySource["search"]>(() =>
    Effect.succeed({
      results: [
        {
          sourceIdentifier: "fixture:website",
          title: "Gabinet Uśmiech Kraków",
          url: "https://usmiech.pl/kontakt",
          description: `Kraków, tel. ${telephone}, kontakt@usmiech.pl`,
          attributes: {},
        },
        {
          sourceIdentifier: "fixture:social",
          title: "Gabinet Uśmiech Kraków",
          url: "https://facebook.com/gabinetusmiech",
          description: "Gabinet dentystyczny w Krakowie",
          attributes: {},
        },
      ],
      moreResults: false,
    }),
  )
}

async function seedIdentityTask(
  databasePath: string,
  requestId: string,
  overrides: Partial<SearchBrief> = {},
): Promise<RunTask> {
  const run = await createTestProspectingRun(databasePath, requestId, overrides)
  const taskId = withDatabase(databasePath, (database) =>
    String(database.prepare("select id from run_tasks where run_id = ?").pluck().get(run.id)),
  )
  await Effect.runPromise(
    makeSqliteDiscoveryRepository(databasePath).recordPage({
      runId: run.id,
      taskId,
      source: "fixture-discovery",
      query: `seed ${requestId}`,
      offset: 0,
      page: {
        results: [
          {
            sourceIdentifier: `fixture:${requestId}`,
            title: "Gabinet Uśmiech",
            url: `https://seed.test/${requestId}`,
            description: "Public discovery input",
            attributes: {},
          },
        ],
        moreResults: false,
      },
      targetCount: 5,
      recordedAt: new Date(),
    }),
  )
  const businessId = withDatabase(databasePath, (database) =>
    String(
      database.prepare("select id from discovered_businesses where run_id = ?").pluck().get(run.id),
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

function readRow(databasePath: string, query: string): Record<string, unknown> | undefined {
  return withDatabase(
    databasePath,
    (database) => database.prepare(query).get() as Record<string, unknown> | undefined,
  )
}

function withDatabase<A>(databasePath: string, use: (database: Database.Database) => A): A {
  const database = new Database(databasePath, { fileMustExist: true })
  try {
    return use(database)
  } finally {
    database.close()
  }
}
