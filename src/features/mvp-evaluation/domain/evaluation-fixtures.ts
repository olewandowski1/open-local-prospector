import type { StructuredBusiness } from "@/features/business-discovery"

type IdentityFixture = Readonly<{
  id: string
  business: StructuredBusiness
  expectedConfirmed: boolean
}>

export const MVP_EVALUATION_VERSION = "mvp-evaluation-v1" as const

export const opportunityFixtures = [
  {
    id: "pl-no-site",
    class: "NoDedicatedWebsite",
    sourceContent: "Pracownia ceramiczna w Łodzi. Rezerwacje przez telefon.",
    websiteState: "NoWebsite",
  },
  {
    id: "pl-broken",
    class: "BrokenOrUnusable",
    sourceContent: "Strona zwraca błąd podczas próby rezerwacji.",
    websiteState: "Present",
  },
  {
    id: "pl-outdated",
    class: "OutdatedPresentation",
    sourceContent: "Nieaktualne godziny i oferta z 2019 roku.",
    websiteState: "Present",
  },
  {
    id: "pl-mobile",
    class: "MobileAccessibilityOrPerformance",
    sourceContent: "Menu zasłania treść na małym ekranie.",
    websiteState: "Present",
  },
  {
    id: "pl-discovery",
    class: "WeakDiscoverability",
    sourceContent: "Brak tytułu opisującego usługę i lokalizację.",
    websiteState: "Present",
  },
  {
    id: "pl-conversion",
    class: "ConfusingConversionJourney",
    sourceContent: "Nie ma widocznej drogi do rezerwacji.",
    websiteState: "Present",
  },
] as const

export const siteConditionFixtures = [
  { id: "strong-existing-site", expectedOpportunity: false },
  { id: "inaccessible-site", expectedInspectionState: "Blocked" },
] as const

// Each fixture states what the structuring step concluded, so this measures the deterministic
// eligibility layer. How well one business is told from another is now a property of the report and
// the verifier, which only a live run can measure.
export const identityFixtures: readonly IdentityFixture[] = [
  ...Array.from(
    { length: 10 },
    (_, index): IdentityFixture => ({
      id: `correct-${index + 1}`,
      business: {
        name: `Pracownia Lokalna ${index + 1}`,
        locality: "Kraków",
        decisionScope: "Local",
        centrallyControlled: false,
        onlineOnly: false,
        sourceUrls: [`https://correct-${index + 1}.example/`],
        presences: [{ type: "Website", url: `https://correct-${index + 1}.example/` }],
        contacts: [
          {
            type: "BusinessTelephone",
            value: "+48123456789",
            sourceUrl: `https://correct-${index + 1}.example/`,
          },
        ],
      },
      expectedConfirmed: true,
    }),
  ),
  {
    id: "ambiguous-directory",
    business: {
      name: "Pracownia Lokalna",
      locality: "Kraków",
      decisionScope: "Ambiguous",
      centrallyControlled: false,
      onlineOnly: false,
      sourceUrls: ["https://ambiguous-directory.example/"],
      presences: [{ type: "Directory", url: "https://ambiguous-directory.example/" }],
      contacts: [],
    },
    expectedConfirmed: false,
  },
  {
    id: "false-positive-chain",
    business: {
      name: "Pracownia Lokalna",
      locality: "Kraków",
      decisionScope: "Central",
      centrallyControlled: true,
      onlineOnly: false,
      sourceUrls: ["https://false-positive-chain.example/"],
      presences: [{ type: "Website", url: "https://false-positive-chain.example/" }],
      contacts: [
        {
          type: "BusinessTelephone",
          value: "+48123456789",
          sourceUrl: "https://false-positive-chain.example/",
        },
      ],
    },
    expectedConfirmed: false,
  },
]
