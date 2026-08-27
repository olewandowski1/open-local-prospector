import { connect } from "node:net"
import { describe, expect, it } from "vitest"

import {
  resolvePinnedConnectTarget,
  startPinnedHttpProxy,
} from "@/features/website-inspection/infrastructure/pinned-http-proxy"

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

  it("names Basic in the tunnel challenge so Chromium can authenticate", async () => {
    const proxy = await startPinnedHttpProxy(async () => ["93.184.216.34"])
    const port = Number(new URL(proxy.playwrightProxy.server).port)
    try {
      const response = await new Promise<string>((resolve, reject) => {
        const socket = connect({ host: "127.0.0.1", port }, () => {
          socket.write("CONNECT public.test:443 HTTP/1.1\r\nHost: public.test:443\r\n\r\n")
        })
        socket.once("data", (chunk) => {
          resolve(chunk.toString("utf8"))
          socket.destroy()
        })
        socket.once("error", reject)
      })
      expect(response).toContain("407 Proxy Authentication Required")
      expect(response).toContain("Proxy-Authenticate: Basic")
    } finally {
      await proxy.close()
    }
  })
})
