import { Effect } from "effect"
import { describe, expect, it, vi } from "vitest"

import type { DiscoveryRuntime } from "@/features/business-discovery"
import { makeAbsenceConfirmationExecutor } from "@/features/business-identity"
import type {
  AbsenceContext,
  IdentityRepository,
} from "@/features/business-identity/application/identity-repository"
import type { RunTask } from "@/features/run-execution"

const REPORT = [
  "1) Kwiaciarnia Sasanka",
  "https://sasanka-kwiaty.pl/",
  "Telefon: 601 234 567",
  "",
  "2) Warsztat Kowalski",
  "https://katalog.test/warsztat-kowalski",
  "Own website: none found.",
].join("\n")

describe("absent website confirmation", () => {
  it("spends nothing when the business is already corroborated", async () => {
    const report = vi.fn()
    const checkpoint = await run({ corroboratingSources: 2 }, { report })

    expect(report).not.toHaveBeenCalled()
    expect(checkpoint.value).toMatchObject({ reason: "already-corroborated" })
    expect(checkpoint.nextTasks?.[0]?.stage).toBe("AssessWebsiteOpportunity")
  })

  // Taking the first business in the report would hand this one its neighbour's website.
  it("does not take a website belonging to another business in the report", async () => {
    const recorded: unknown[] = []
    const checkpoint = await run(
      { name: "Warsztat Kowalski", corroboratingSources: 1 },
      {},
      recorded,
    )

    expect(checkpoint.value).toMatchObject({ confirmed: true })
    expect(checkpoint.nextTasks?.[0]?.stage).toBe("AssessWebsiteOpportunity")
    expect(recorded[0]).not.toHaveProperty("websiteUrl")
  })

  it("inspects a website the first pass missed instead of scoring the business as absent", async () => {
    const checkpoint = await run({ name: "Kwiaciarnia Sasanka", corroboratingSources: 1 })

    expect(checkpoint.value).toMatchObject({ websiteFound: true })
    expect(checkpoint.nextTasks?.[0]).toMatchObject({
      stage: "InspectWebsite",
      input: expect.objectContaining({ websiteUrl: "https://sasanka-kwiaty.pl/" }),
    })
  })
})

async function run(
  overrides: Partial<AbsenceContext>,
  runtimeOverrides: Partial<DiscoveryRuntime> = {},
  recorded: unknown[] = [],
) {
  const context: AbsenceContext = {
    canonicalBusinessId: "canonical-1",
    name: "Warsztat Kowalski",
    locality: "Rumia",
    searchBrief: {
      location: "Rumia",
      category: "Car repair garages",
      targetCount: 5,
      mode: "Quick",
      runtime: "codex",
      searchArea: {
        id: "relation:1",
        displayName: "Rumia, Polska",
        latitude: 54.57,
        longitude: 18.39,
        countryCode: "PL",
      },
    },
    corroboratingSources: 1,
    ...overrides,
  } as AbsenceContext

  const repository = {
    loadAbsenceContext: () => Effect.succeed(context),
    recordAbsenceConfirmation: (input: unknown) => {
      recorded.push(input)
      return Effect.void
    },
  } as unknown as IdentityRepository

  const runtime = {
    identifier: "codex",
    report: () => Effect.succeed(REPORT),
    structure: () =>
      Effect.succeed({
        schemaVersion: "discovery-structure-v1",
        businesses: [
          business("Kwiaciarnia Sasanka", "https://sasanka-kwiaty.pl/"),
          business("Warsztat Kowalski", undefined, "https://katalog.test/warsztat-kowalski"),
        ],
      }),
    ...runtimeOverrides,
  } as unknown as DiscoveryRuntime

  const task = {
    id: "task-1",
    runId: "run-1",
    stage: "ConfirmAbsentWebsite",
    input: { runBusinessId: "run-business-1", inspectionId: "inspection-1" },
  } as unknown as RunTask

  return Effect.runPromise(makeAbsenceConfirmationExecutor(repository, runtime)(task))
}

function business(name: string, websiteUrl?: string, source = websiteUrl) {
  return {
    name,
    locality: "Rumia",
    decisionScope: "Local",
    centrallyControlled: false,
    onlineOnly: false,
    ...(websiteUrl ? { websiteUrl } : {}),
    sourceUrls: source ? [source] : [],
    presences: websiteUrl ? [{ type: "Website", url: websiteUrl }] : [],
    contacts: [],
  }
}
