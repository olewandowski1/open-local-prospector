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
      path: "src/worker/main.ts",
      source: 'import Page from "@/app/page"',
    },
  ])("rejects $path importing an outer module", (module) => {
    expect(findFeatureBoundaryViolations([module])).toHaveLength(1)
  })
})
