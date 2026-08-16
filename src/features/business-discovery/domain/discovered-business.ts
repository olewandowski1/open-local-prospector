export type DiscoverySearchRequest = Readonly<{
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

export function normalizeBusinessName(value: string): string {
  return value.trim().toLocaleLowerCase("pl").replace(/\s+/gu, " ").slice(0, 300)
}
