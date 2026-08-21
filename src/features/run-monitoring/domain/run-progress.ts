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

export type BusinessProgress = Readonly<{
  id: string
  /** Discovered name, absent for runs checkpointed before names were recorded. */
  name?: string
  currentStage: string
  status: string
  retryCount: number
  failureReason?: string
  /** The opportunity score this business was judged on, absent until scoring has run. */
  score?: number
  /** True when the score cleared the review threshold. */
  qualified?: boolean
  /** How many Technical Run Log entries name this business. The entries themselves live in the log. */
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
    /** The most recent entries, newest first, capped at `technicalLogLimit`. */
    technicalLog: readonly TechnicalRunEvent[]
    technicalLogLimit: number
    /** True when the run holds older entries than the ones returned. */
    technicalLogTruncated: boolean
  }>
