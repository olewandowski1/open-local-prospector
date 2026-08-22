export type IdentityEvidence = Readonly<{
  sourceIdentifier: string
  title: string
  url: string
  description?: string
  collectedAt: Date
  reciprocalLink?: boolean
}>

export type OnlinePresenceType = "Website" | "SocialProfile" | "Directory"
export type AssociationState = "Confirmed" | "Ambiguous"
export type ContactRouteType =
  | "GenericEmail"
  | "BusinessTelephone"
  | "ContactForm"
  | "SocialMessaging"

export type OnlinePresence = Readonly<{
  type: OnlinePresenceType
  url: string
  sourceIdentifier: string
  associationState: AssociationState
  collectedAt: Date
}>

export type ContactRoute = Readonly<{
  type: ContactRouteType
  value: string
  sourceUrl: string
  collectedAt: Date
}>

export type IdentityInput = Readonly<{
  name: string
  searchAreaName: string
  countryCode: string
  evidence: readonly IdentityEvidence[]
}>

export type IdentityEvaluation = Readonly<{
  status: "Eligible" | "Ambiguous" | "Excluded"
  canonicalFingerprint?: string
  canonicalName: string
  decisionScope: "Local" | "Ambiguous" | "Central"
  signals: readonly string[]
  presences: readonly OnlinePresence[]
  contacts: readonly ContactRoute[]
  exclusionCode?:
    | "identity-ambiguous"
    | "national-chain"
    | "central-franchise"
    | "online-only"
    | "missing-contact"
  exclusionReason?: string
}>

const SOCIAL_HOSTS = ["facebook.com", "instagram.com", "linkedin.com", "tiktok.com"]
const DIRECTORY_HOSTS = [
  "panoramafirm.pl",
  "pkt.pl",
  "zumi.pl",
  "cylex-polska.pl",
  "orlyflorystyki.pl",
  "godzinyotwarcia24.pl",
  "cityon.pl",
  "starofservice.pl",
  "studentnews.pl",
  "kwiatyyy.pl",
  "kwiaciarnie-weselne.pl",
  "uslugi24.pl",
  "kwiatowadostawa.pl",
  "szukajsklepu.pl",
  "kwiaty-bukiety.com.pl",
  "yelp.com",
  "google.com",
]
const GENERIC_EMAIL_NAMES = new Set([
  "biuro",
  "bok",
  "contact",
  "hello",
  "info",
  "kontakt",
  "office",
  "recepcja",
  "rezerwacje",
  "sekretariat",
])

export function evaluateBusinessIdentity(input: IdentityInput): IdentityEvaluation {
  const canonicalName = businessNameWithoutPublisher(input.name, input.evidence)
  const normalizedName = normalizeWords(canonicalName)
  const locality = normalizeWords(input.searchAreaName.split(",")[0] ?? input.searchAreaName)
  const relevantEvidence = input.evidence.filter((evidence) => safePublicUrl(evidence.url))
  const contacts = uniqueContacts(relevantEvidence.flatMap(extractContactRoutes))
  const evidenceText = relevantEvidence
    .map((item) => `${item.title} ${item.description ?? ""}`)
    .join(" ")
    .toLocaleLowerCase("pl")
  const nameMatches = relevantEvidence.filter(
    (item) => wordSimilarity(normalizedName, normalizeWords(item.title)) >= 0.5,
  )
  const locationMatched = locality.length >= 3 && normalizeWords(evidenceText).includes(locality)
  const reciprocalMatched = relevantEvidence.some((item) => item.reciprocalLink === true)
  const addressMatched = /\b\d{2}-\d{3}\b/u.test(evidenceText) && locationMatched
  const signals = [
    ...(nameMatches.length > 0 ? ["NameMatch"] : []),
    ...(locationMatched ? ["SearchAreaMatch"] : []),
    ...(addressMatched ? ["AddressMatch"] : []),
    ...(contacts.some((contact) => contact.type === "BusinessTelephone") ? ["TelephoneMatch"] : []),
    ...(reciprocalMatched ? ["ReciprocalLink"] : []),
    ...(nameMatches.length >= 2 ? ["RepeatedPublicPresence"] : []),
  ]
  const corroborated =
    nameMatches.length > 0 &&
    (locationMatched ||
      addressMatched ||
      contacts.length > 0 ||
      reciprocalMatched ||
      nameMatches.length >= 2)
  const presences = uniquePresences(
    relevantEvidence.map((evidence) => ({
      type: presenceType(evidence.url),
      url: evidence.url,
      sourceIdentifier: evidence.sourceIdentifier,
      associationState:
        wordSimilarity(normalizedName, normalizeWords(evidence.title)) >= 0.5 && corroborated
          ? "Confirmed"
          : "Ambiguous",
      collectedAt: evidence.collectedAt,
    })),
  )
  const canonicalFingerprint = fingerprint(
    canonicalName,
    locality,
    input.countryCode,
    contacts,
    presences,
  )

  if (!corroborated) {
    return excluded({
      status: "Ambiguous",
      canonicalName,
      decisionScope: "Ambiguous",
      signals,
      presences,
      contacts: [],
      exclusionCode: "identity-ambiguous",
      exclusionReason: "Available public signals do not safely confirm this business association.",
    })
  }
  if (
    /(ogólnopolska sieć|national chain|centrally controlled|ponad \d+ lokalizacji)/u.test(
      evidenceText,
    )
  ) {
    return excluded({
      canonicalName,
      signals,
      presences,
      contacts,
      canonicalFingerprint,
      exclusionCode: "national-chain",
      exclusionReason: "Public evidence identifies a national or centrally controlled chain.",
    })
  }
  if (/\b(franczyz\w*|franchise)\b/u.test(evidenceText)) {
    return excluded({
      canonicalName,
      signals,
      presences,
      contacts,
      canonicalFingerprint,
      exclusionCode: "central-franchise",
      exclusionReason: "Public evidence indicates centrally controlled franchise decisions.",
    })
  }
  if (
    /\b(sklep internetowy|online-only|wyłącznie online)\b/u.test(evidenceText) &&
    !locationMatched
  ) {
    return excluded({
      canonicalName,
      signals,
      presences,
      contacts,
      canonicalFingerprint,
      exclusionCode: "online-only",
      exclusionReason:
        "Public evidence indicates an online-only business without a local decision point.",
    })
  }
  if (contacts.length === 0) {
    return excluded({
      canonicalName,
      signals,
      presences,
      contacts,
      canonicalFingerprint,
      exclusionCode: "missing-contact",
      exclusionReason: "No public generic business Contact Route was found.",
    })
  }

  return {
    status: "Eligible",
    canonicalFingerprint,
    canonicalName,
    decisionScope: "Local",
    signals,
    presences,
    contacts,
  }
}

// Telephone, then website, then name: each directory titles the same business differently.
function fingerprint(
  canonicalName: string,
  locality: string,
  countryCode: string,
  contacts: readonly ContactRoute[],
  presences: readonly OnlinePresence[],
): string {
  const country = countryCode.toUpperCase()
  const telephone = contacts.find((contact) => contact.type === "BusinessTelephone")?.value
  if (telephone) return `tel:${normalizeWords(telephone)}|${country}`

  const website = presences.find(
    (presence) => presence.type === "Website" && presence.associationState === "Confirmed",
  )
  const host = website ? websiteHost(website.url) : undefined
  if (host) return `web:${host}|${country}`

  return `name:${normalizeWords(canonicalName)}|${normalizeWords(locality)}|${country}`
}

// `www.` is routing, not identity, so both spellings key the same business.
function websiteHost(url: string): string | undefined {
  try {
    return normalizeWords(new URL(url).hostname.replace(/^www\./u, ""))
  } catch {
    return undefined
  }
}

// Only a trailing segment naming a publisher of these results is removed, so a name containing a dash keeps it.
export function businessNameWithoutPublisher(
  name: string,
  evidence: readonly IdentityInput["evidence"][number][],
): string {
  const trimmed = name.trim().slice(0, 500)
  const publishers = new Set(
    evidence.flatMap((item) => {
      try {
        const host = new URL(item.url).hostname.toLocaleLowerCase("en").replace(/^www\./u, "")
        return [normalizeWords(host), normalizeWords(host.split(".")[0] ?? host)]
      } catch {
        return []
      }
    }),
  )
  for (const host of DIRECTORY_HOSTS) {
    publishers.add(normalizeWords(host))
    publishers.add(normalizeWords(host.split(".")[0] ?? host))
  }

  const segments = trimmed.split(/\s+[-|–—]\s+/u)
  if (segments.length < 2) return trimmed
  const tail = segments.at(-1) ?? ""
  const normalizedTail = normalizeWords(tail)
  if (normalizedTail === "") return trimmed
  // A publisher suffix may carry a year or extra words, so containment counts either way.
  const isPublisher = [...publishers].some(
    (publisher) =>
      publisher.length >= 4 &&
      (normalizedTail === publisher ||
        normalizedTail.startsWith(`${publisher} `) ||
        normalizedTail.includes(publisher)),
  )
  if (!isPublisher) return trimmed
  const kept = segments.slice(0, -1).join(" - ").trim()
  return kept === "" ? trimmed : kept
}

function excluded(
  value: Omit<IdentityEvaluation, "status" | "decisionScope"> &
    Partial<Pick<IdentityEvaluation, "status" | "decisionScope">>,
): IdentityEvaluation {
  return { status: "Excluded", decisionScope: "Central", ...value }
}

function extractContactRoutes(evidence: IdentityEvidence): readonly ContactRoute[] {
  const text = `${evidence.title} ${evidence.description ?? ""}`
  const contacts: ContactRoute[] = []
  for (const match of text.matchAll(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/giu)) {
    const email = match[0].toLocaleLowerCase("en")
    if (GENERIC_EMAIL_NAMES.has(email.split("@")[0] ?? "")) {
      contacts.push({
        type: "GenericEmail",
        value: email,
        sourceUrl: evidence.url,
        collectedAt: evidence.collectedAt,
      })
    }
  }
  for (const match of text.matchAll(/(?:\+48[\s.-]?)?(?:\d[\s.-]?){9}\b/gu)) {
    const digits = match[0].replace(/\D/gu, "")
    if (digits.length === 9 || (digits.length === 11 && digits.startsWith("48"))) {
      contacts.push({
        type: "BusinessTelephone",
        value: `+${digits.length === 9 ? `48${digits}` : digits}`,
        sourceUrl: evidence.url,
        collectedAt: evidence.collectedAt,
      })
    }
  }
  const url = new URL(evidence.url)
  if (/\b(kontakt|contact|rezerwac|booking)\b/u.test(url.pathname.toLocaleLowerCase("pl"))) {
    contacts.push({
      type: "ContactForm",
      value: evidence.url,
      sourceUrl: evidence.url,
      collectedAt: evidence.collectedAt,
    })
  }
  if (SOCIAL_HOSTS.some((host) => matchesHost(url.hostname, host))) {
    contacts.push({
      type: "SocialMessaging",
      value: evidence.url,
      sourceUrl: evidence.url,
      collectedAt: evidence.collectedAt,
    })
  }
  return contacts
}

function presenceType(value: string): OnlinePresenceType {
  const hostname = new URL(value).hostname
  if (SOCIAL_HOSTS.some((host) => matchesHost(hostname, host))) return "SocialProfile"
  if (DIRECTORY_HOSTS.some((host) => matchesHost(hostname, host))) return "Directory"
  return "Website"
}

function matchesHost(hostname: string, expected: string): boolean {
  const normalized = hostname.toLocaleLowerCase("en")
  return normalized === expected || normalized.endsWith(`.${expected}`)
}

function safePublicUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:"
  } catch {
    return false
  }
}

function normalizeWords(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pl")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ")
}

function wordSimilarity(left: string, right: string): number {
  const leftWords = new Set(left.split(" ").filter((word) => word.length > 1))
  const rightWords = new Set(right.split(" ").filter((word) => word.length > 1))
  if (leftWords.size === 0 || rightWords.size === 0) return 0
  const shared = [...leftWords].filter((word) => rightWords.has(word)).length
  return shared / Math.min(leftWords.size, rightWords.size)
}

function uniqueContacts(contacts: readonly ContactRoute[]): readonly ContactRoute[] {
  const seen = new Set<string>()
  return contacts.filter((contact) => {
    const key = `${contact.type}:${contact.value}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function uniquePresences(presences: readonly OnlinePresence[]): readonly OnlinePresence[] {
  const seen = new Set<string>()
  return presences.filter((presence) => {
    if (seen.has(presence.url)) return false
    seen.add(presence.url)
    return true
  })
}
