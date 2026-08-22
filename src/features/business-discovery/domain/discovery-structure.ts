import { Effect, JSONSchema, Schema } from "effect"

export const DISCOVERY_REPORT_PROMPT_VERSION = "discovery-report-v1" as const
export const DISCOVERY_STRUCTURE_PROMPT_VERSION = "discovery-structure-v1" as const
export const DISCOVERY_STRUCTURE_SCHEMA_VERSION = "discovery-structure-v1" as const

export const MAX_REPORT_CHARACTERS = 60_000

export const ContactRouteTypeSchema = Schema.Literal(
  "GenericEmail",
  "BusinessTelephone",
  "ContactForm",
  "SocialMessaging",
)

export const PresenceTypeSchema = Schema.Literal("Website", "SocialProfile", "Directory")

export const DecisionScopeSchema = Schema.Literal("Local", "Ambiguous", "Central")

const Url = Schema.String.pipe(Schema.minLength(1), Schema.maxLength(2_000))

export const StructuredContactSchema = Schema.Struct({
  type: ContactRouteTypeSchema,
  value: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(500)),
  sourceUrl: Url,
})

export const StructuredPresenceSchema = Schema.Struct({
  type: PresenceTypeSchema,
  url: Url,
})

export const StructuredBusinessSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(300)),
  locality: Schema.String.pipe(Schema.maxLength(200)),
  decisionScope: DecisionScopeSchema,
  centrallyControlled: Schema.Boolean,
  onlineOnly: Schema.Boolean,
  websiteUrl: Schema.optional(Url),
  sourceUrls: Schema.Array(Url).pipe(Schema.minItems(1), Schema.maxItems(20)),
  presences: Schema.Array(StructuredPresenceSchema).pipe(Schema.maxItems(20)),
  contacts: Schema.Array(StructuredContactSchema).pipe(Schema.maxItems(20)),
})

export const DiscoveryStructureSchema = Schema.Struct({
  schemaVersion: Schema.Literal(DISCOVERY_STRUCTURE_SCHEMA_VERSION),
  businesses: Schema.Array(StructuredBusinessSchema).pipe(Schema.maxItems(40)),
})

export type StructuredContact = typeof StructuredContactSchema.Type
export type StructuredPresence = typeof StructuredPresenceSchema.Type
export type StructuredBusiness = typeof StructuredBusinessSchema.Type
export type DiscoveryStructure = typeof DiscoveryStructureSchema.Type

export const discoveryStructureJsonSchema = JSONSchema.make(DiscoveryStructureSchema)

export class DiscoveryStructureError extends Error {
  constructor(
    readonly code: "malformed-output" | "out-of-stage-output" | "no-verifiable-business",
    message: string,
  ) {
    super(message)
  }
}

export type VerificationRejection = Readonly<{
  business: string
  kind: "source" | "presence" | "contact" | "website"
  value: string
  reason: string
}>

export type VerifiedStructure = Readonly<{
  businesses: readonly StructuredBusiness[]
  rejections: readonly VerificationRejection[]
}>

const OUT_OF_STAGE_KEYS = [
  "opportunities",
  "score",
  "ranking",
  "outreach",
  "message",
  "email_draft",
]

export function decodeDiscoveryStructure(value: unknown) {
  return Schema.decodeUnknown(DiscoveryStructureSchema, { onExcessProperty: "error" })(value).pipe(
    Effect.mapError(
      () =>
        new DiscoveryStructureError(
          hasOutOfStageKeys(value) ? "out-of-stage-output" : "malformed-output",
          "The runtime output does not match the discovery-structure schema.",
        ),
    ),
  )
}

/**
 * Keeps only what the report actually supports. A model may summarise, but it may not introduce a
 * source, a website, or a contact that nobody wrote down.
 */
export function verifyAgainstReport(
  structure: DiscoveryStructure,
  report: string,
  countryCode: string,
  isPublicUrl: (value: string) => boolean,
): VerifiedStructure {
  const reportUrls = new Set(extractReportUrls(report).map(canonicalUrl))
  const blocks = reportBlocks(report)
  const rejections: VerificationRejection[] = []
  const businesses: StructuredBusiness[] = []

  for (const business of structure.businesses) {
    const cited = (url: string, kind: VerificationRejection["kind"]): boolean => {
      if (!isPublicUrl(url)) {
        rejections.push({ business: business.name, kind, value: url, reason: "not-public-http" })
        return false
      }
      if (!reportUrls.has(canonicalUrl(url))) {
        rejections.push({ business: business.name, kind, value: url, reason: "not-in-report" })
        return false
      }
      return true
    }

    const sourceUrls = business.sourceUrls.filter((url) => cited(url, "source"))
    if (sourceUrls.length === 0) continue

    const presences = business.presences.filter((presence) => cited(presence.url, "presence"))
    const websiteUrl =
      business.websiteUrl && cited(business.websiteUrl, "website") ? business.websiteUrl : undefined
    const contacts = business.contacts.filter((contact) => {
      if (!cited(contact.sourceUrl, "contact")) return false
      const reason = contactRejection(contact, countryCode, blocksCiting(blocks, contact.sourceUrl))
      if (reason) {
        rejections.push({ business: business.name, kind: "contact", value: contact.value, reason })
        return false
      }
      return true
    })

    businesses.push({
      ...business,
      sourceUrls,
      presences,
      contacts,
      ...(websiteUrl ? { websiteUrl } : {}),
    })
  }

  return { businesses, rejections }
}

type ReportBlock = Readonly<{ text: string; lowercased: string; digits: ReadonlySet<string> }>

/**
 * The report is written one business per block, so a contact is only supported where it is written
 * down beside the source it is claimed from. Checking the whole report instead would accept a
 * neighbour's telephone, which is the mistake this whole step exists to stop.
 */
function reportBlocks(report: string): readonly ReportBlock[] {
  return report
    .split(/\n\s*\n/u)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({
      text,
      lowercased: text.toLocaleLowerCase("pl"),
      digits: digitRuns(text),
    }))
}

function blocksCiting(blocks: readonly ReportBlock[], sourceUrl: string): readonly ReportBlock[] {
  const canonical = canonicalUrl(sourceUrl)
  return blocks.filter((block) =>
    extractReportUrls(block.text).some((url) => canonicalUrl(url) === canonical),
  )
}

/**
 * Numbers a block actually writes down, with the spacing people use inside one number removed.
 * Whole runs only: "265013667" sitting inside a Facebook page id is not a telephone number.
 */
function digitRuns(text: string): ReadonlySet<string> {
  const runs = new Set<string>()
  for (const match of text.matchAll(/\d[\d\s.\-()]*\d/gu)) {
    runs.add(match[0].replace(/\D+/gu, ""))
  }
  return runs
}

function contactRejection(
  contact: StructuredContact,
  countryCode: string,
  blocks: readonly ReportBlock[],
): string | undefined {
  if (contact.type === "ContactForm" || contact.type === "SocialMessaging") {
    // The value is the address itself, which was already checked against the report.
    return contact.value === contact.sourceUrl ? undefined : "value-is-not-the-cited-url"
  }
  if (blocks.length === 0) return "not-beside-its-source"
  if (contact.type === "GenericEmail") {
    const email = contact.value.toLocaleLowerCase("en")
    return blocks.some((block) => block.lowercased.includes(email))
      ? undefined
      : "not-beside-its-source"
  }
  const digits = contact.value.replace(/\D+/gu, "")
  const national = digits.startsWith("48") && digits.length === 11 ? digits.slice(2) : digits
  if (national.length !== 9) return "not-nine-digits"
  if (countryCode.toUpperCase() === "PL" && !POLISH_NUMBER_PREFIXES.has(national.slice(0, 2))) {
    return "prefix-not-in-numbering-plan"
  }
  return blocks.some((block) => block.digits.has(national) || block.digits.has(`48${national}`))
    ? undefined
    : "not-beside-its-source"
}

// Mobile ranges and geographic area codes actually assigned in Poland.
const POLISH_NUMBER_PREFIXES = new Set(
  "45 50 51 53 57 60 66 69 72 73 78 79 88 12 13 14 15 16 17 18 22 23 24 25 29 32 33 34 41 42 43 44 46 48 52 54 55 56 58 59 61 62 63 65 67 68 71 74 75 76 77 81 82 83 84 85 86 87 89 91 94 95".split(
    " ",
  ),
)

export function extractReportUrls(report: string): readonly string[] {
  return [...report.matchAll(/https?:\/\/[^\s<>"'\])}]+/giu)].map((match) =>
    match[0].replace(/[.,;:]+$/u, ""),
  )
}

function canonicalUrl(value: string): string {
  try {
    const url = new URL(value)
    url.hash = ""
    url.hostname = url.hostname.toLowerCase().replace(/^www\./u, "")
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/u, "")
    return url.toString()
  } catch {
    return value.trim()
  }
}

function hasOutOfStageKeys(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false
  return OUT_OF_STAGE_KEYS.some((key) => key in (value as Record<string, unknown>))
}
