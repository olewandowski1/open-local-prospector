export type OverviewRunItem = Readonly<{
  location: string
  category: string
  found: number
  candidates: number
  state:
    | Readonly<{ kind: "completion"; label: "Target Reached" }>
    | Readonly<{ kind: "progress"; label: "Assessing" }>
  time: string
}>

export const overviewStats = [
  { label: "Businesses found", value: "184", note: "+32 this week" },
  { label: "Strong candidates", value: "47", note: "26% qualify" },
  { label: "Awaiting review", value: "18", note: "6 high priority" },
  { label: "Active scans", value: "2", note: "Kraków & Gdańsk" },
] as const

export const overviewRuns: readonly OverviewRunItem[] = [
  {
    location: "Kraków",
    category: "Dental clinics",
    found: 38,
    candidates: 12,
    state: { kind: "completion", label: "Target Reached" },
    time: "12 min ago",
  },
  {
    location: "Gdańsk",
    category: "Interior designers",
    found: 24,
    candidates: 7,
    state: { kind: "progress", label: "Assessing" },
    time: "Now",
  },
  {
    location: "Wrocław",
    category: "Physiotherapy",
    found: 42,
    candidates: 15,
    state: { kind: "completion", label: "Target Reached" },
    time: "Yesterday",
  },
]

export const overviewCandidates = [
  { name: "Studio Forma", location: "Kraków", score: 91, reason: "No website found" },
  { name: "Dentica Plus", location: "Kraków", score: 84, reason: "Outdated, non-mobile site" },
  { name: "Meble Północ", location: "Gdańsk", score: 78, reason: "Social-only presence" },
] as const
