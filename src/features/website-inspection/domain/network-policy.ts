import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

export class NetworkPolicyError extends Error {
  readonly code:
    | "unsafe-protocol"
    | "credentials-in-url"
    | "local-hostname"
    | "private-address"
    | "unresolvable-host"
    | "unexpected-navigation"

  constructor(code: NetworkPolicyError["code"], message: string) {
    super(message)
    this.name = "NetworkPolicyError"
    this.code = code
  }
}

export type ResolveHost = (hostname: string) => Promise<readonly string[]>

export const resolveHostAddresses: ResolveHost = async (hostname) =>
  (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address)

export async function validatePublicHttpUrl(
  value: string,
  resolveHost: ResolveHost = resolveHostAddresses,
): Promise<URL> {
  return (await resolvePublicHttpUrl(value, resolveHost)).url
}

export async function resolvePublicHttpUrl(
  value: string,
  resolveHost: ResolveHost = resolveHostAddresses,
): Promise<Readonly<{ url: URL; addresses: readonly string[] }>> {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new NetworkPolicyError(
      "unsafe-protocol",
      "Only valid public HTTP(S) URLs may be inspected.",
    )
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new NetworkPolicyError("unsafe-protocol", "Only public HTTP(S) URLs may be inspected.")
  }
  if (url.username || url.password) {
    throw new NetworkPolicyError("credentials-in-url", "Credential-bearing URLs are not inspected.")
  }
  const hostname = url.hostname.replace(/^\[|\]$/gu, "").toLocaleLowerCase("en")
  if (
    hostname === "localhost" ||
    hostname === "localhost.localdomain" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "0"
  ) {
    throw new NetworkPolicyError("local-hostname", "Local and special-use hostnames are blocked.")
  }

  let addresses: readonly string[]
  if (isIP(hostname)) {
    addresses = [hostname]
  } else {
    try {
      addresses = await resolveHost(hostname)
    } catch {
      throw new NetworkPolicyError(
        "unresolvable-host",
        "The public hostname could not be resolved.",
      )
    }
  }
  if (addresses.length === 0) {
    throw new NetworkPolicyError("unresolvable-host", "The public hostname returned no addresses.")
  }
  if (addresses.some(isPrivateOrReservedAddress)) {
    throw new NetworkPolicyError(
      "private-address",
      "Private, local, and special-use network ranges are blocked.",
    )
  }
  return { url, addresses }
}

export function assertApprovedNavigation(initialUrl: string, destinationUrl: string): void {
  const initial = new URL(initialUrl)
  const destination = new URL(destinationUrl)
  const normalize = (hostname: string) => hostname.toLocaleLowerCase("en").replace(/^www\./u, "")
  if (normalize(initial.hostname) !== normalize(destination.hostname)) {
    throw new NetworkPolicyError(
      "unexpected-navigation",
      "Unexpected cross-origin top-level navigation was blocked.",
    )
  }
}

export function isPrivateOrReservedAddress(address: string): boolean {
  if (isIP(address) === 4) return isBlockedIpv4(address)
  if (isIP(address) === 6) return isBlockedIpv6(address)
  return true
}

function isBlockedIpv4(address: string): boolean {
  const [a, b, c] = address.split(".").map(Number)
  if (a === undefined || b === undefined || c === undefined) return true
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  )
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLocaleLowerCase("en")
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length)
    return isIP(mapped) !== 4 || isBlockedIpv4(mapped)
  }
  const first = ipv6FirstHextet(normalized)
  return (
    normalized.startsWith("::") ||
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xffc0) === 0xfec0 ||
    (first & 0xff00) === 0xff00 ||
    normalized.startsWith("2001:db8:")
  )
}

function ipv6FirstHextet(address: string): number {
  const first = address.split(":")[0]
  return first ? Number.parseInt(first, 16) : 0
}
