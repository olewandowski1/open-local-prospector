import { describe, expect, it } from "vitest"

import {
  businessNameWithoutPublisher,
  evaluateBusinessIdentity,
} from "@/features/business-identity/domain/business-identity"

const collectedAt = new Date("2026-08-20T10:00:00.000Z")

/** The same florist as four different directories titled it, all listing the same telephone. */
const sameFloristEverywhere = [
  {
    name: "Kwiaciarnia Koniczynka Agnieszka Jasińska - Kwiatyyy.pl",
    url: "https://www.kwiatyyy.pl/kwiaciarnie/1601",
  },
  {
    name: "Kwiaciarnia Koniczynka - Kwiaciarnie-Weselne.pl",
    url: "https://koniczynka-zdzieszowice.kwiaciarnie-weselne.pl/",
  },
  {
    name: "Kwiaciarnie Zdzieszowice - Orły Florystyki 2026",
    url: "https://orlyflorystyki.pl/kwiaciarnie/zdzieszowice",
  },
  {
    name: "10 najlepszych kwiaciarni w Zdzieszowicach - StarOfService",
    url: "https://www.starofservice.pl/kwiaciarnie/zdzieszowice",
  },
] as const

function evaluate(name: string, url: string) {
  return evaluateBusinessIdentity({
    name,
    searchAreaName: "Zdzieszowice, gmina Zdzieszowice, Polska",
    countryCode: "PL",
    evidence: [
      {
        sourceIdentifier: "subscription-runtime-web-search",
        title: name,
        url,
        description: "Kwiaciarnia w Zdzieszowice, 47-330, tel. +48 693 896 955",
        collectedAt,
      },
    ],
  })
}

describe("businessNameWithoutPublisher", () => {
  it("drops the site that published the page", () => {
    expect(
      businessNameWithoutPublisher("Kwiaciarnia Koniczynka - Kwiaciarnie-Weselne.pl", [
        {
          sourceIdentifier: "s",
          title: "t",
          url: "https://koniczynka-zdzieszowice.kwiaciarnie-weselne.pl/",
          collectedAt,
        },
      ]),
    ).toBe("Kwiaciarnia Koniczynka")
  })

  it("drops a known directory even when the result came from elsewhere", () => {
    expect(
      businessNameWithoutPublisher("Kwiaciarnia Joanna Koncewicz - GodzinyOtwarcia24", []),
    ).toBe("Kwiaciarnia Joanna Koncewicz")
  })

  it("keeps a dash that belongs to the business", () => {
    expect(businessNameWithoutPublisher("Kwiaciarnia Weronika Kwiatek-Binda", [])).toBe(
      "Kwiaciarnia Weronika Kwiatek-Binda",
    )
    expect(businessNameWithoutPublisher("Upominek. Kwiaciarnia. Mazurek U.J.", [])).toBe(
      "Upominek. Kwiaciarnia. Mazurek U.J.",
    )
  })

  it("never returns an empty name", () => {
    expect(businessNameWithoutPublisher("Kwiatyyy.pl", [])).toBe("Kwiatyyy.pl")
  })
})

describe("identity fingerprint", () => {
  it("gives one business one fingerprint however many directories list it", () => {
    const fingerprints = new Set(
      sameFloristEverywhere.map((entry) => evaluate(entry.name, entry.url).canonicalFingerprint),
    )

    expect(fingerprints.size).toBe(1)
    expect([...fingerprints][0]).toBe("tel:48693896955|PL")
  })

  it("still separates two businesses that share nothing but a locality", () => {
    const one = evaluate("Kwiaciarnia Margaret", "https://margaret.example.pl/")
    const two = evaluateBusinessIdentity({
      name: "Kwiaciarnia Botanica",
      searchAreaName: "Zdzieszowice, gmina Zdzieszowice, Polska",
      countryCode: "PL",
      evidence: [
        {
          sourceIdentifier: "subscription-runtime-web-search",
          title: "Kwiaciarnia Botanica",
          url: "https://botanica.example.pl/",
          description: "Kwiaciarnia w Zdzieszowice, 47-330, tel. +48 668 289 881",
          collectedAt,
        },
      ],
    })

    expect(one.canonicalFingerprint).not.toBe(two.canonicalFingerprint)
  })
})
