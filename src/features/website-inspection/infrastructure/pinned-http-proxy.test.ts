import { describe, expect, it } from "vitest"

import { resolvePinnedConnectTarget } from "@/features/website-inspection/infrastructure/pinned-http-proxy"

describe("pinned inspection proxy", () => {
  it("connects to the numeric address returned by the approved lookup", async () => {
    await expect(
      resolvePinnedConnectTarget("public.test:8443", async () => ["93.184.216.34"]),
    ).resolves.toEqual({ address: "93.184.216.34", port: 8443 })
  })

  it("refuses a CONNECT destination when DNS returns a private address", async () => {
    await expect(
      resolvePinnedConnectTarget("rebound.test:443", async () => ["127.0.0.1"]),
    ).rejects.toMatchObject({ code: "private-address" })
  })
})
