import { describe, expect, it } from "vitest"

import { openCodeRuntimePolicy } from "@/features/runtime-settings/application/opencode-runtime-policy"

describe("OpenCode runtime policy", () => {
  it("allows only public search tools during discovery", () => {
    const policy = openCodeRuntimePolicy("public-web-search")
    const configuration = JSON.parse(policy.environment.OPENCODE_CONFIG_CONTENT)
    const agentName = policy.arguments[2]

    expect(policy.arguments).toEqual(["--pure", "--agent", "open-prospector-public-search"])
    expect(configuration.permission).toEqual({ "*": "deny" })
    expect(configuration.agent[agentName].permission).toEqual({
      "*": "deny",
      websearch: "allow",
      webfetch: "allow",
    })
  })

  it("withdraws every tool while untrusted evidence is interpreted", () => {
    const policy = openCodeRuntimePolicy("no-tools")
    const configuration = JSON.parse(policy.environment.OPENCODE_CONFIG_CONTENT)
    const agentName = policy.arguments[2]

    expect(policy.arguments).toEqual(["--pure", "--agent", "open-prospector-no-tools"])
    expect(configuration.agent[agentName].permission).toEqual({ "*": "deny" })
  })
})
