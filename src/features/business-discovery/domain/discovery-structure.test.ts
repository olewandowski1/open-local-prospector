import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import {
  type DiscoveryStructure,
  decodeDiscoveryStructure,
  type StructuredBusiness,
  verifyAgainstReport,
} from "@/features/business-discovery/domain/discovery-structure"

const REPORT = [
  "Salon fryzjerski Justyna — Reda.",
  "  https://www.facebook.com/fryzjerjustynareda",
  "  Telephone written on the page: 504 713 619. No website of its own.",
  "",
  "Salon fryzjerski Bellezza — Reda.",
  "  https://www.facebook.com/p/Salon-fryzjerski-Bellezza-61579265013667",
  "  No telephone was published. No website of its own.",
  "",
  "Fryzjernia Krasa — Reda.",
  "  https://www.fryzjerniakrasa.pl/",
  "  https://www.fryzjerniakrasa.pl/kontakt",
  "  Telephone 794 002 525, email kontakt@fryzjerniakrasa.pl.",
].join("\n")

const isPublicUrl = (value: string) => /^https:\/\//u.test(value)

describe("discovery structure verification", () => {
  it("keeps what the report supports", () => {
    const { businesses, rejections } = verify([
      business({
        name: "Fryzjernia Krasa",
        websiteUrl: "https://www.fryzjerniakrasa.pl/",
        sourceUrls: ["https://www.fryzjerniakrasa.pl/", "https://www.fryzjerniakrasa.pl/kontakt"],
        presences: [{ type: "Website", url: "https://www.fryzjerniakrasa.pl/" }],
        contacts: [
          {
            type: "BusinessTelephone",
            value: "+48794002525",
            sourceUrl: "https://www.fryzjerniakrasa.pl/kontakt",
          },
          {
            type: "GenericEmail",
            value: "kontakt@fryzjerniakrasa.pl",
            sourceUrl: "https://www.fryzjerniakrasa.pl/kontakt",
          },
        ],
      }),
    ])

    expect(rejections).toEqual([])
    expect(businesses).toHaveLength(1)
    expect(businesses[0]?.contacts.map((contact) => contact.value)).toEqual([
      "+48794002525",
      "kontakt@fryzjerniakrasa.pl",
    ])
  })

  // The failure that made this necessary: one salon's telephone shown against another salon.
  it("drops a contact the report never wrote down", () => {
    const { businesses, rejections } = verify([
      business({
        name: "Salon fryzjerski Bellezza",
        sourceUrls: ["https://www.facebook.com/p/Salon-fryzjerski-Bellezza-61579265013667"],
        contacts: [
          {
            type: "BusinessTelephone",
            value: "+48504713619",
            sourceUrl: "https://www.facebook.com/p/Salon-fryzjerski-Bellezza-61579265013667",
          },
        ],
      }),
    ])

    expect(businesses[0]?.contacts).toEqual([])
    expect(rejections).toContainEqual(
      expect.objectContaining({ kind: "contact", reason: "not-beside-its-source" }),
    )
  })

  it("refuses a nine-digit run taken out of a page id", () => {
    const { businesses, rejections } = verify([
      business({
        name: "Salon fryzjerski Bellezza",
        sourceUrls: ["https://www.facebook.com/p/Salon-fryzjerski-Bellezza-61579265013667"],
        contacts: [
          {
            type: "BusinessTelephone",
            value: "+48265013667",
            sourceUrl: "https://www.facebook.com/p/Salon-fryzjerski-Bellezza-61579265013667",
          },
        ],
      }),
    ])

    expect(businesses[0]?.contacts).toEqual([])
    expect(rejections).toContainEqual(
      expect.objectContaining({ reason: "prefix-not-in-numbering-plan" }),
    )
  })

  it("drops a source the model introduced by itself", () => {
    const { businesses, rejections } = verify([
      business({
        name: "Salon fryzjerski Justyna",
        sourceUrls: [
          "https://www.facebook.com/fryzjerjustynareda",
          "https://invented.example/justyna",
        ],
      }),
    ])

    expect(businesses[0]?.sourceUrls).toEqual(["https://www.facebook.com/fryzjerjustynareda"])
    expect(rejections).toContainEqual(
      expect.objectContaining({ kind: "source", reason: "not-in-report" }),
    )
  })

  it("drops a business whose every source was unverifiable", () => {
    const { businesses } = verify([
      business({ name: "Nowhere", sourceUrls: ["https://invented.example/a"] }),
    ])

    expect(businesses).toEqual([])
  })

  it("refuses a non-public address", () => {
    const { rejections } = verify([
      business({ name: "Local", sourceUrls: ["http://127.0.0.1/admin"] }),
    ])

    expect(rejections).toContainEqual(
      expect.objectContaining({ kind: "source", reason: "not-public-http" }),
    )
  })

  it("rejects output that strays outside the structuring stage", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        decodeDiscoveryStructure({
          schemaVersion: "discovery-structure-v1",
          businesses: [],
          opportunities: [],
        }),
      ),
    )

    expect(failure.code).toBe("out-of-stage-output")
  })
})

function verify(businesses: readonly StructuredBusiness[]) {
  const structure: DiscoveryStructure = { schemaVersion: "discovery-structure-v1", businesses }
  return verifyAgainstReport(structure, REPORT, "PL", isPublicUrl)
}

function business(overrides: Partial<StructuredBusiness> & { name: string }): StructuredBusiness {
  return {
    locality: "Reda",
    decisionScope: "Local",
    centrallyControlled: false,
    onlineOnly: false,
    sourceUrls: [],
    presences: [],
    contacts: [],
    ...overrides,
  }
}
