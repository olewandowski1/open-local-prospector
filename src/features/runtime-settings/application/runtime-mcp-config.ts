/**
 * An empty MCP configuration still has to satisfy the CLI's schema: a bare object is rejected with
 * "mcpServers: expected record, received undefined" and the process exits without a result.
 */
export const EMPTY_MCP_CONFIG = JSON.stringify({ mcpServers: {} })
