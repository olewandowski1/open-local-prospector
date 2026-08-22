// A bare `{}` is rejected as "mcpServers: expected record" and the CLI exits with no result.
export const EMPTY_MCP_CONFIG = JSON.stringify({ mcpServers: {} })
