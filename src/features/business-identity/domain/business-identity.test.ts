import { describe, expect, it } from "vitest"

import type { StructuredBusiness } from "@/features/business-discovery"
import { evaluateBusinessIdentity } from "@/features/business-identity/domain/business-identity"

const collectedAt = new Date("2026-08-16T10:00:00.000Z")

describe("business identity evaluation", () => {
  it("accepts a local business that kept a verified contact route", () => {
    const result = evaluate(
      business({
        contacts: [
          {
            type: "BusinessTelephone",
            value: "+48123456789",
            sourceUrl: "https://usmiech.pl/kontakt",
          },
        ],
        websiteUrl: "https://usmiech.pl/",
        sourceUrls: ["https://usmiech.pl/", "https://usmiech.pl/kontakt"],
      }),
    )

    expect(result).toMatchObject({ status: "Eligible", decisionScope: "Local" })
    expect(result.signals).toEqual(
      expect.arrayContaining([
        "StructuredAttribution",
        "RepeatedPublicPresence",
        "WebsiteConfirmed",
        "TelephoneMatch",
      ]),
    )
  })

  it("keeps an association the report did not settle out of the queue", () => {
    const result = evaluate(business({ decisionScope: "Ambiguous" }))

    expect(result).toMatchObject({ status: "Ambiguous", exclusionCode: "identity-ambiguous" })
    // Contacts are withheld: an unsettled association must not hand over a telephone number.
    expect(result.contacts).toEqual([])
    expect(result.canonicalFingerprint).toBeUndefined()
  })

  it("excludes a centrally controlled outlet", () => {
    expect(evaluate(business({ centrallyControlled: true }))).toMatchObject({
      status: "Excluded",
      decisionScope: "Central",
      exclusionCode: "national-chain",
    })
  })

  it("excludes an online-only business", () => {
    expect(evaluate(business({ onlineOnly: true }))).toMatchObject({
      status: "Excluded",
      exclusionCode: "online-only",
    })
  })

  it("excludes a business with nothing to contact it by", () => {
    expect(evaluate(business({ contacts: [] }))).toMatchObject({
      status: "Excluded",
      exclusionCode: "missing-contact",
    })
  })
})

describe("canonical fingerprint", () => {
  // One florist as four directories titled it, all publishing the same telephone.
  it("keys one business on its telephone however the page was titled", () => {
    const telephone = {
      type: "BusinessTelephone",
      value: "+48693896955",
      sourceUrl: "https://www.kwiatyyy.pl/kwiaciarnie/1601",
    } as const
    const fingerprints = [
      "Kwiaciarnia Koniczynka",
      "Kwiaciarnia Koniczynka Agnieszka Jasińska",
      "KWIACIARNIA KONICZYNKA",
    ].map((name) => evaluate(business({ name, contacts: [telephone] })).canonicalFingerprint)

    expect(new Set(fingerprints).size).toBe(1)
  })

  it("falls back to the website host, then to the name and locality", () => {
    const byWebsite = evaluate(
      business({ contacts: [], websiteUrl: "https://www.usmiech.pl/kontakt" }),
    )
    const bySameHost = evaluate(business({ contacts: [], websiteUrl: "https://usmiech.pl/" }))
    expect(byWebsite.canonicalFingerprint).toBe(bySameHost.canonicalFingerprint)

    const byName = evaluate(business({ contacts: [] }))
    expect(byName.canonicalFingerprint).toBe("name:gabinet usmiech|krakow|PL")
  })

  it("keeps same-name businesses separate when their non-telephone contacts differ", () => {
    const first = evaluate(
      business({
        contacts: [
          {
            type: "GenericEmail",
            value: "first@example.test",
            sourceUrl: "https://directory.example/first",
          },
        ],
      }),
    )
    const second = evaluate(
      business({
        contacts: [
          {
            type: "GenericEmail",
            value: "second@example.test",
            sourceUrl: "https://directory.example/second",
          },
        ],
      }),
    )

    expect(first.canonicalFingerprint).not.toBe(second.canonicalFingerprint)
    expect(first.canonicalFingerprint).toBe("contact:GenericEmail:first@example.test|PL")
  })
})

function evaluate(value: StructuredBusiness) {
  return evaluateBusinessIdentity({ business: value, countryCode: "PL", collectedAt })
}

function business(overrides: Partial<StructuredBusiness> = {}): StructuredBusiness {
  return {
    name: "Gabinet Uśmiech",
    locality: "Kraków",
    decisionScope: "Local",
    centrallyControlled: false,
    onlineOnly: false,
    sourceUrls: ["https://usmiech.pl/"],
    presences: [{ type: "Website", url: "https://usmiech.pl/" }],
    contacts: [
      { type: "BusinessTelephone", value: "+48123456789", sourceUrl: "https://usmiech.pl/" },
    ],
    ...overrides,
  }
}
