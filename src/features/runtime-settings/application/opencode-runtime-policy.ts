export type OpenCodeRuntimeAuthority = "public-web-search" | "no-tools"

const AGENT_NAMES: Readonly<Record<OpenCodeRuntimeAuthority, string>> = {
  "public-web-search": "open-prospector-public-search",
  "no-tools": "open-prospector-no-tools",
}

/** Prevent user configuration and plugins from granting tools to untrusted source content. */
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
