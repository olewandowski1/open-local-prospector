import { describe, expect, it } from "vitest"

import { EMPTY_MCP_CONFIG } from "@/features/runtime-settings/application/runtime-mcp-config"

describe("EMPTY_MCP_CONFIG", () => {
  it("satisfies the shape the CLI validates against", () => {
    // A bare "{}" is rejected with "mcpServers: expected record, received undefined", and the process
    // exits without a result — which took down every Claude-backed run at its first step.
    expect(JSON.parse(EMPTY_MCP_CONFIG)).toEqual({ mcpServers: {} })
  })

  it("declares no servers, so --strict-mcp-config leaves the runtime with none", () => {
    const parsed = JSON.parse(EMPTY_MCP_CONFIG) as { mcpServers: Record<string, unknown> }
    expect(Object.keys(parsed.mcpServers)).toHaveLength(0)
  })
})
