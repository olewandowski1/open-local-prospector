import type { SearchBrief } from "@/features/prospecting-runs"

export const runCompletionStates = [
  "Target Reached",
  "Search Exhausted",
  "Cancelled with Partial Results",
  "Paused",
  "Runtime Unavailable",
  "Completed with Warnings",
  "Infrastructure Failed",
] as const

export type RunCompletionState = (typeof runCompletionStates)[number]

export type RunProgressCounts = Readonly<{
  queries: number
  discoveries: number
  duplicates: number
  exclusions: number
  websites: number
  assessments: number
  qualifiedCandidates: number
  blockedInspections: number
  targetRemaining: number
}>

export type RunSummary = Readonly<{
  id: string
  state: string
  completionState?: RunCompletionState
  currentStage?: string
  searchBrief: SearchBrief
  progress: RunProgressCounts
  createdAt: string
  updatedAt: string
  version: number
}>

export type BoundedRunList = Readonly<{
  runs: readonly RunSummary[]
  limit: number
  truncated: boolean
  overview: RunOverviewSnapshot
}>

export type RunOverviewSnapshot = Readonly<{
  discoveries: number
  activeRuns: number
  discoveriesThisWeek: number
  discoveriesLastWeek: number
  hasRuns: boolean
}>

export type BusinessProgress = Readonly<{
  id: string
  // Absent for runs checkpointed before names were recorded.
  name?: string
  currentStage: string
  status: string
  retryCount: number
  failureReason?: string
  score?: number
  qualified?: boolean
  sourceEventCount: number
}>

export type TechnicalRunEvent = Readonly<{
  id: string
  kind: string
  stage?: string
  businessId?: string
  sourceIdentifier?: string
  resultUrl?: string
  message: string
  createdAt: string
}>

export type RunDetail = RunSummary &
  Readonly<{
    requestedControl: string
    businesses: readonly BusinessProgress[]
    technicalLog: readonly TechnicalRunEvent[]
    technicalLogLimit: number
    technicalLogTruncated: boolean
  }>
