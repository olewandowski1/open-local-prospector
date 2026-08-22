import { describe, expect, it } from "vitest"

import {
  CLASSIFIED_WORKSPACE_TABLES,
  PROSPECTING_DATA_TABLES,
  unclassifiedWorkspaceTables,
} from "@/features/workspace-administration/domain/workspace-schema"

describe("workspace schema classification", () => {
  it("classifies all 30 application tables exactly once", () => {
    expect(CLASSIFIED_WORKSPACE_TABLES).toHaveLength(30)
    expect(new Set(CLASSIFIED_WORKSPACE_TABLES).size).toBe(30)
    expect(PROSPECTING_DATA_TABLES).toHaveLength(25)
  })

  it("reports an unknown table", () => {
    expect(unclassifiedWorkspaceTables([...CLASSIFIED_WORKSPACE_TABLES, "new_table"])).toEqual([
      "new_table",
    ])
  })
})
