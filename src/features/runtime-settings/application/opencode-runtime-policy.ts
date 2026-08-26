export type OpenCodeRuntimeAuthority = "public-web-search" | "no-tools"

const AGENT_NAMES: Readonly<Record<OpenCodeRuntimeAuthority, string>> = {
  "public-web-search": "open-prospector-public-search",
  "no-tools": "open-prospector-no-tools",
}

/**
 * OpenCode merges user configuration into every invocation. An application-owned agent with an
 * inline, highest-precedence permission policy keeps that configuration from granting authority
 * to untrusted source content. `--pure` separately prevents external plugins from adding tools.
 */
export function openCodeRuntimePolicy(authority: OpenCodeRuntimeAuthority) {
  const agentName = AGENT_NAMES[authority]
  const permission =
    authority === "public-web-search"
      ? { "*": "deny", websearch: "allow", webfetch: "allow" }
      : { "*": "deny" }
  const configuration = {
    permission: { "*": "deny" },
    agent: {
      [agentName]: {
        description:
          authority === "public-web-search"
            ? "Search public sources for Open Prospector"
            : "Structure untrusted evidence for Open Prospector without tools",
        mode: "primary",
        permission,
      },
    },
  }

  return {
    arguments: ["--pure", "--agent", agentName] as const,
    environment: { OPENCODE_CONFIG_CONTENT: JSON.stringify(configuration) },
  }
}
