export type DiscoverySearchRequest = Readonly<{
  runtime: "codex" | "claude"
  runtimeConfiguration?: Readonly<{ model: string; reasoningEffort: string }>
  query: string
  count: number
  offset: number
  country: string
  searchLanguage: string
}>

export type DiscoveryResult = Readonly<{
  sourceIdentifier: string
  title: string
  url: string
  description?: string
  attributes: Readonly<Record<string, string>>
}>

export type DiscoveryPage = Readonly<{
  results: readonly DiscoveryResult[]
  moreResults: boolean
}>

export type DiscoveredBusiness = Readonly<{
  id: string
  sourceIdentifier: string
  name: string
  resultUrl: string
  description?: string
}>

export function normalizeDiscoveryUrl(value: string): string | undefined {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
    if (isPrivateHostname(url.hostname)) return undefined
    url.hash = ""
    url.hostname = url.hostname.toLowerCase()
    if (
      (url.protocol === "https:" && url.port === "443") ||
      (url.protocol === "http:" && url.port === "80")
    ) {
      url.port = ""
    }
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/u, "")
    return url.toString()
  } catch {
    return undefined
  }
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/gu, "")
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized === "::1") {
    return true
  }
  if (/^127\./u.test(normalized) || /^10\./u.test(normalized) || /^192\.168\./u.test(normalized)) {
    return true
  }
  if (
    normalized === "0.0.0.0" ||
    /^169\.254\./u.test(normalized) ||
    /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./u.test(normalized) ||
    /^(?:fc|fd|fe8|fe9|fea|feb)/u.test(normalized)
  ) {
    return true
  }
  const match = /^172\.(\d+)\./u.exec(normalized)
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31)
}

export function normalizeBusinessName(value: string): string {
  return value.trim().toLocaleLowerCase("pl").replace(/\s+/gu, " ").slice(0, 300)
}
