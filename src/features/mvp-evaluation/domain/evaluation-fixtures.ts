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

export const identityFixtures = [
  ...Array.from({ length: 10 }, (_, index) => ({
    id: `correct-${index + 1}`,
    name: `Pracownia Lokalna ${index + 1}`,
    title: `Pracownia Lokalna ${index + 1} Kraków`,
    description: "Kraków, kontakt 12 345 67 89",
    expectedConfirmed: true,
  })),
  {
    id: "ambiguous-directory",
    name: "Pracownia Lokalna",
    title: "Najlepsze firmy",
    description: "Ogólny katalog",
    expectedConfirmed: false,
  },
  {
    id: "false-positive-chain",
    name: "Pracownia Lokalna",
    title: "Pracownia Lokalna Kraków",
    description: "Kraków, ogólnopolska sieć, kontakt 12 345 67 89",
    expectedConfirmed: false,
  },
] as const
