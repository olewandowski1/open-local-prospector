import { describe, expect, it } from "vitest"

import { findFeatureBoundaryViolations } from "@/architecture/feature-boundaries"

describe("feature dependency boundaries", () => {
  it("accepts inward dependencies and feature public interfaces", () => {
    expect(
      findFeatureBoundaryViolations([
        {
          path: "src/features/prospecting-runs/application/run.ts",
          source:
            'import type { SearchBrief } from "@/features/prospecting-runs/domain/search-brief"',
        },
        {
          path: "src/features/overview/server/overview.ts",
          source: 'import type { RunSummary } from "@/features/prospecting-runs"',
        },
        {
          path: "src/features/overview/presentation/overview.tsx",
          source: 'import { RuntimeIcon } from "@/features/runtime-settings/client"',
        },
        {
          path: "src/features/overview/infrastructure/repository.ts",
          source: 'export type { Metric } from "@/features/overview/domain/metric"',
        },
        {
          path: "src/features/overview/application/load-overview.ts",
          source: 'const domain = import("@/features/overview/domain/overview")',
        },
        {
          path: "src/features/overview/presentation/overview.tsx",
          source: 'import { loadOverview } from "@/features/overview/server/load-overview"',
        },
        {
          path: "src/features/overview/client.ts",
          source: 'export { OverviewPage } from "@/features/overview/presentation/overview-page"',
        },
        {
          path: "src/features/overview/client.ts",
          source: 'export type { OverviewRow } from "@/features/overview/server/load-overview"',
        },
      ]),
    ).toEqual([])
  })

  it.each([
    {
      path: "src/features/overview/server/overview.ts",
      source: 'import { repository } from "@/features/prospecting-runs/infrastructure/repository"',
    },
    {
      path: "src/features/prospecting-runs/domain/search-brief.ts",
      source: 'import { NextResponse } from "next/server"',
    },
    {
      path: "src/features/prospecting-runs/application/run.ts",
      source: 'import { repository } from "@/features/prospecting-runs/infrastructure/repository"',
    },
    {
      path: "src/features/prospecting-runs/domain/search-brief.ts",
      source: 'import { chromium } from "playwright"',
    },
    {
      path: "src/features/prospecting-runs/application/run.ts",
      source: 'import Database from "better-sqlite3"',
    },
    {
      path: "src/features/prospecting-runs/application/run.ts",
      source: 'import { spawn } from "node:child_process"',
    },
    {
      path: "src/features/prospecting-runs/domain/search-brief.ts",
      source: 'export { startRun } from "@/features/prospecting-runs/application/run"',
    },
    {
      path: "src/features/prospecting-runs/infrastructure/repository.ts",
      source: 'import { RunPage } from "@/features/prospecting-runs/presentation/run-page"',
    },
    {
      path: "src/features/prospecting-runs/presentation/run-page.tsx",
      source: 'const repository = import("@/features/prospecting-runs/infrastructure/repository")',
    },
    {
      path: "src/worker/main.ts",
      source: 'import Page from "@/app/page"',
    },
    {
      path: "src/features/overview/client.ts",
      source: 'export { loadOverview } from "@/features/overview/server/load-overview"',
    },
    {
      path: "src/features/overview/client.ts",
      source: 'export { repository } from "@/features/overview/infrastructure/repository"',
    },
    {
      path: "src/features/overview/client.ts",
      source: 'import { readFile } from "node:fs"',
    },
  ])("rejects $path importing an outer module", (module) => {
    expect(findFeatureBoundaryViolations([module])).toHaveLength(1)
  })
})
