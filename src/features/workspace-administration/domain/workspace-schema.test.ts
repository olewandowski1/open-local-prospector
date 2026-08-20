import { describe, expect, it } from "vitest"

import {
  CLASSIFIED_WORKSPACE_TABLES,
  PROSPECTING_DATA_TABLES,
  unclassifiedWorkspaceTables,
} from "@/features/workspace-administration/domain/workspace-schema"

describe("workspace schema classification", () => {
  it("classifies all 29 application tables exactly once", () => {
    expect(CLASSIFIED_WORKSPACE_TABLES).toHaveLength(29)
    expect(new Set(CLASSIFIED_WORKSPACE_TABLES).size).toBe(29)
    expect(PROSPECTING_DATA_TABLES).toHaveLength(24)
  })

  it("reports an unknown table", () => {
    expect(unclassifiedWorkspaceTables([...CLASSIFIED_WORKSPACE_TABLES, "new_table"])).toEqual([
      "new_table",
    ])
  })
})
