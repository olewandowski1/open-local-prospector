import { describe, expect, it } from "vitest"

import {
  assertApprovedNavigation,
  isPrivateOrReservedAddress,
  validatePublicHttpUrl,
} from "@/features/website-inspection/domain/network-policy"

describe("website inspection network policy", () => {
  it.each([
    "http://127.0.0.1",
    "http://127.1",
    "http://2130706433",
    "http://[::1]",
    "http://10.0.0.1",
    "http://169.254.169.254/latest/meta-data",
    "http://192.168.1.1",
  ])("rejects private or aliased destination %s", async (url) => {
    await expect(validatePublicHttpUrl(url)).rejects.toMatchObject({ code: "private-address" })
  })

  it.each([
    "file:///etc/passwd",
    "data:text/plain,hello",
    "ftp://example.com",
    "javascript:alert(1)",
  ])("rejects unsafe protocol %s", async (url) => {
    await expect(validatePublicHttpUrl(url)).rejects.toMatchObject({ code: "unsafe-protocol" })
  })

  it.each(["http://localhost", "http://app.localhost", "http://router.local"])(
    "rejects local hostname %s",
    async (url) => {
      await expect(validatePublicHttpUrl(url)).rejects.toMatchObject({ code: "local-hostname" })
    },
  )

  it("rejects a public-looking hostname when DNS resolves privately", async () => {
    await expect(
      validatePublicHttpUrl("https://public.test", async () => ["10.0.0.7"]),
    ).rejects.toMatchObject({ code: "private-address" })
  })

  it("accepts public IPv4 and IPv6 resolutions", async () => {
    await expect(
      validatePublicHttpUrl("https://example.com", async () => [
        "93.184.216.34",
        "2606:2800:220:1:248:1893:25c8:1946",
      ]),
    ).resolves.toMatchObject({ hostname: "example.com" })
    expect(isPrivateOrReservedAddress("93.184.216.34")).toBe(false)
  })

  it("allows same-site http-to-https and www navigation but rejects another host", () => {
    expect(() =>
      assertApprovedNavigation("http://example.com", "https://www.example.com/contact"),
    ).not.toThrow()
    expect(() => assertApprovedNavigation("https://example.com", "https://attacker.test")).toThrow(
      expect.objectContaining({ code: "unexpected-navigation" }),
    )
  })
})
