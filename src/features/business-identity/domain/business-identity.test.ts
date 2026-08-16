import { describe, expect, it } from "vitest"

import {
  evaluateBusinessIdentity,
  type IdentityEvidence,
} from "@/features/business-identity/domain/business-identity"

const collectedAt = new Date("2026-08-16T10:00:00.000Z")

describe("business identity evaluation fixtures", () => {
  it("confirms a local business from matching name, area, website, and generic contact", () => {
    const result = evaluateBusinessIdentity(
      input([
        evidence(
          "Gabinet Uśmiech Kraków",
          "https://usmiech.pl/kontakt",
          "Kraków, tel. 12 345 67 89, kontakt@usmiech.pl",
        ),
        evidence("Gabinet Uśmiech", "https://facebook.com/gabinetusmiech", "Dentysta Kraków"),
      ]),
    )
    expect(result).toMatchObject({ status: "Eligible", decisionScope: "Local" })
    expect(result.signals).toEqual(
      expect.arrayContaining(["NameMatch", "SearchAreaMatch", "TelephoneMatch"]),
    )
    expect(result.presences.map((presence) => presence.type)).toEqual(["Website", "SocialProfile"])
    expect(result.contacts.map((contact) => contact.type)).toEqual(
      expect.arrayContaining([
        "GenericEmail",
        "BusinessTelephone",
        "ContactForm",
        "SocialMessaging",
      ]),
    )
  })

  it("keeps an unsupported association visibly ambiguous", () => {
    const result = evaluateBusinessIdentity(
      input([evidence("Najlepsi dentyści", "https://directory.test/list", "Ogólny katalog")]),
    )
    expect(result).toMatchObject({ status: "Ambiguous", exclusionCode: "identity-ambiguous" })
    expect(result.presences[0]?.associationState).toBe("Ambiguous")
    expect(result.canonicalFingerprint).toBeUndefined()
  })

  it.each([
    ["national-chain", "Gabinet Uśmiech Kraków — ogólnopolska sieć, kontakt 12 345 67 89"],
    ["central-franchise", "Gabinet Uśmiech Kraków — franczyza, kontakt 12 345 67 89"],
    ["online-only", "Gabinet Uśmiech — sklep internetowy wyłącznie online, kontakt 12 345 67 89"],
  ] as const)("excludes %s eligibility", (exclusionCode, description) => {
    const searchAreaName = exclusionCode === "online-only" ? "Warszawa, Polska" : "Kraków, Polska"
    const result = evaluateBusinessIdentity({
      ...input([evidence("Gabinet Uśmiech", "https://usmiech.pl/kontakt", description)]),
      searchAreaName,
    })
    expect(result).toMatchObject({ status: "Excluded", exclusionCode })
  })

  it("supports a no-site local business through public social presence and messaging", () => {
    const result = evaluateBusinessIdentity(
      input([
        evidence(
          "Gabinet Uśmiech Kraków",
          "https://instagram.com/gabinetusmiech",
          "Aktywny gabinet w Krakowie",
        ),
        evidence("Gabinet Uśmiech Kraków", "https://facebook.com/gabinetusmiech", "Kraków"),
      ]),
    )
    expect(result.status).toBe("Eligible")
    expect(result.presences.some((presence) => presence.type === "Website")).toBe(false)
    expect(result.contacts.some((contact) => contact.type === "SocialMessaging")).toBe(true)
  })

  it("excludes a confirmed identity without a public contact route", () => {
    const result = evaluateBusinessIdentity(
      input([
        evidence("Gabinet Uśmiech Kraków", "https://usmiech.pl", "Gabinet dentystyczny Kraków"),
        evidence("Gabinet Uśmiech", "https://directory.test/usmiech", "Kraków"),
      ]),
    )
    expect(result).toMatchObject({ status: "Excluded", exclusionCode: "missing-contact" })
  })

  it("does not collect named professional email addresses", () => {
    const result = evaluateBusinessIdentity(
      input([
        evidence(
          "Gabinet Uśmiech Kraków",
          "https://usmiech.pl",
          "Kraków jan.kowalski@usmiech.pl, info@usmiech.pl",
        ),
      ]),
    )
    expect(result.contacts.map((contact) => contact.value)).toContain("info@usmiech.pl")
    expect(result.contacts.map((contact) => contact.value)).not.toContain("jan.kowalski@usmiech.pl")
  })
})

function input(evidenceItems: readonly IdentityEvidence[]) {
  return {
    name: "Gabinet Uśmiech",
    searchAreaName: "Kraków, Polska",
    countryCode: "PL",
    evidence: evidenceItems,
  }
}

function evidence(title: string, url: string, description: string): IdentityEvidence {
  return { sourceIdentifier: `fixture:${url}`, title, url, description, collectedAt }
}
