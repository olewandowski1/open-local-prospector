import Database from "better-sqlite3"
import { loadLocalApplicationConfig } from "@/features/local-application"
import { CURRENT_SCORE_PER_BUSINESS } from "@/features/review-queue/infrastructure/current-candidate-score"
import type { PageMeasurements } from "@/features/website-inspection"

// The evidence is deliberately absent: sending it per candidate put the whole queue's screenshots into the page.
export type QueueCandidateSummary = Readonly<{
  id: string
  name: string
  locality: string
  score: number
  primaryOpportunity: string
  contactAvailable: boolean
  reviewStatus: string
}>

export type BoundedReviewQueue = Readonly<{
  candidates: readonly QueueCandidateSummary[]
  limit: number
  truncated: boolean
}>

export type QueueCandidate = Readonly<{
  id: string
  name: string
  locality: string
  score: number
  primaryOpportunity: string
  websiteAvailable: boolean
  contactAvailable: boolean
  confidence: number
  inspectionState: string
  reviewStatus: string
  rejectionReason?: string
  rejectionNote?: string
  privateNotes: string
  followUpAt?: string
  observations: readonly Readonly<{
    statement: string
    sourceUrl: string
    evidenceState: string
    observedAt: string
  }>[]
  breakdown: Readonly<{
    severity: number
    confidence: number
    contact: number
    localDecision: number
    commercialValue: number
  }>
  rubricVersion: string
  opportunities: readonly Readonly<{
    opportunityClass: string
    explanation: string
    severity: number
  }>[]
  presences: readonly Readonly<{ type: string; url: string }>[]
  contacts: readonly Readonly<{ type: string; value: string; sourceUrl: string }>[]
  screenshots: readonly Readonly<{ id: string; viewport: string }>[]
  measurements: readonly Readonly<{ id: string; viewport: string; values: PageMeasurements }>[]
  limitations: readonly string[]
  corrections: readonly Readonly<{
    target: string
    correctedValue: string
    note: string
    createdAt: string
  }>[]
}>
type QueueRow = {
  id: string
  name: string
  locality: string
  total: number
  severity_component: number
  confidence_component: number
  contact_component: number
  local_decision_component: number
  commercial_value_component: number
  rubric_version: string
  opportunity_class: string
  confidence: number
  inspection_state: string
  website_available: number
  contact_available: number
  review_status: string | null
  rejection_reason: string | null
  rejection_note: string | null
  private_notes: string | null
  follow_up_at: number | null
  run_business_id: string
  assessment_id: string
  inspection_id: string
}

const QUEUE_SELECT = `select cs.id,cs.run_business_id,cs.assessment_id,wa.inspection_id,cb.name,cb.locality,cs.total,cs.severity_component,cs.confidence_component,cs.contact_component,cs.local_decision_component,cs.commercial_value_component,cs.rubric_version,case when wi.status='Blocked' then 'LimitedWebsiteEvidence' else wo.opportunity_class end opportunity_class,wo.confidence,wi.status inspection_state,exists(select 1 from online_presences op where op.run_business_id=cs.run_business_id and op.type='Website' and op.association_state='Confirmed') website_available,exists(select 1 from contact_routes cr where cr.run_business_id=cs.run_business_id) contact_available,crv.status review_status,crv.rejection_reason,crv.rejection_note,crv.private_notes,crv.follow_up_at from candidate_scores cs join canonical_businesses cb on cb.id=cs.canonical_business_id join website_assessments wa on wa.id=cs.assessment_id join website_inspections wi on wi.id=wa.inspection_id join website_opportunities wo on wo.id=(select id from website_opportunities where assessment_id=wa.id order by severity desc,confidence desc,sequence limit 1) left join candidate_reviews crv on crv.score_id=cs.id left join suppression_entries se on se.identity_fingerprint=cb.identity_fingerprint where cs.qualified=1 and se.identity_fingerprint is null and ${CURRENT_SCORE_PER_BUSINESS}`

// The queue only grows, and the whole of it is serialised into the page.
const REVIEW_QUEUE_LIMIT = 500

// A read failure is left to surface: an empty queue and an unreachable database look identical otherwise.
export function getReviewQueueSummaries(): BoundedReviewQueue {
  let db: Database.Database | undefined
  try {
    const database = new Database(loadLocalApplicationConfig().databasePath, {
      readonly: true,
      fileMustExist: true,
    })
    db = database
    const rows = database
      .prepare(`${QUEUE_SELECT} order by cs.total desc,cb.name collate nocase,cs.id limit ?`)
      .all(REVIEW_QUEUE_LIMIT + 1) as QueueRow[]
    return {
      candidates: rows.slice(0, REVIEW_QUEUE_LIMIT).map((row) => ({
        id: row.id,
        name: row.name,
        locality: row.locality,
        score: row.total,
        primaryOpportunity: row.opportunity_class,
        contactAvailable: Boolean(row.contact_available),
        reviewStatus: row.review_status ?? "Unreviewed",
      })),
      limit: REVIEW_QUEUE_LIMIT,
      truncated: rows.length > REVIEW_QUEUE_LIMIT,
    }
  } finally {
    db?.close()
  }
}

export function getQueueCandidate(scoreId: string): QueueCandidate | undefined {
  return readQueueCandidate(scoreId)[0]
}

function readQueueCandidate(scoreId: string): readonly QueueCandidate[] {
  let db: Database.Database | undefined
  try {
    const database = new Database(loadLocalApplicationConfig().databasePath, {
      readonly: true,
      fileMustExist: true,
    })
    db = database
    const rows = database
      .prepare(`${QUEUE_SELECT} and cs.id = ? order by cs.total desc,cb.name collate nocase,cs.id`)
      .all(scoreId) as QueueRow[]
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      locality: row.locality,
      score: row.total,
      primaryOpportunity: row.opportunity_class,
      websiteAvailable: Boolean(row.website_available),
      contactAvailable: Boolean(row.contact_available),
      confidence: row.confidence,
      inspectionState: row.inspection_state,
      reviewStatus: row.review_status ?? "Unreviewed",
      ...(row.rejection_reason ? { rejectionReason: row.rejection_reason } : {}),
      ...(row.rejection_note ? { rejectionNote: row.rejection_note } : {}),
      privateNotes: row.private_notes ?? "",
      ...(row.follow_up_at
        ? { followUpAt: new Date(row.follow_up_at).toISOString().slice(0, 10) }
        : {}),
      observations: (
        database
          .prepare(
            `select so.statement,so.source_url,so.evidence_state,so.observed_at from supporting_observations so join website_opportunities wo on wo.id=so.opportunity_id where wo.assessment_id=? order by wo.severity desc,so.confidence desc,so.sequence`,
          )
          .all(row.assessment_id) as {
          statement: string
          source_url: string
          evidence_state: string
          observed_at: number
        }[]
      ).map((item) => ({
        statement: item.statement,
        sourceUrl: item.source_url,
        evidenceState: item.evidence_state,
        observedAt: new Date(item.observed_at).toISOString(),
      })),
      opportunities: (
        database
          .prepare(
            "select opportunity_class,explanation,severity from website_opportunities where assessment_id=? order by severity desc,sequence",
          )
          .all(row.assessment_id) as {
          opportunity_class: string
          explanation: string
          severity: number
        }[]
      ).map((item) => ({
        opportunityClass: item.opportunity_class,
        explanation: item.explanation,
        severity: item.severity,
      })),
      presences: database
        .prepare(
          "select type,url from online_presences where run_business_id=? and association_state='Confirmed' order by collected_at,id",
        )
        .all(row.run_business_id) as { type: string; url: string }[],
      contacts: (
        database
          .prepare(
            "select type,value,source_url from contact_routes where run_business_id=? order by collected_at,id",
          )
          .all(row.run_business_id) as { type: string; value: string; source_url: string }[]
      ).map((item) => ({ type: item.type, value: item.value, sourceUrl: item.source_url })),
      screenshots: (
        database
          .prepare(
            "select id,viewport from inspection_artifacts where inspection_id=? and kind='Screenshot' order by created_at,id",
          )
          .all(row.inspection_id) as { id: string; viewport: string }[]
      ).map((item) => ({ id: item.id, viewport: item.viewport })),
      measurements: (
        database
          .prepare(
            "select id,viewport,measurements from inspection_pages where inspection_id=? order by sequence,viewport",
          )
          .all(row.inspection_id) as { id: string; viewport: string; measurements: string }[]
      ).map((item) => ({
        id: item.id,
        viewport: item.viewport,
        values: JSON.parse(item.measurements) as PageMeasurements,
      })),
      limitations: (
        database
          .prepare(
            "select code from inspection_blocks where inspection_id=? order by recorded_at,id",
          )
          .all(row.inspection_id) as { code: string }[]
      ).map((item) => item.code),
      corrections: (
        database
          .prepare(
            "select target,corrected_value,note,created_at from candidate_corrections where score_id=? order by created_at,id",
          )
          .all(row.id) as {
          target: string
          corrected_value: string
          note: string
          created_at: number
        }[]
      ).map((item) => ({
        target: item.target,
        correctedValue: item.corrected_value,
        note: item.note,
        createdAt: new Date(item.created_at).toISOString(),
      })),
      breakdown: {
        severity: row.severity_component,
        confidence: row.confidence_component,
        contact: row.contact_component,
        localDecision: row.local_decision_component,
        commercialValue: row.commercial_value_component,
      },
      rubricVersion: row.rubric_version,
    }))
  } finally {
    db?.close()
  }
}

export type RecentCandidate = Readonly<{
  id: string
  runId: string
  name: string
  locality: string
  score: number
  primaryOpportunity: string
  reviewStatus: string
  contactAvailable: boolean
  scoredAt: string
}>

export type CandidateSummary = Readonly<{
  qualified: number
  unreviewed: number
  shortlisted: number
  topScore: number
  qualifiedThisWeek: number
  qualifiedLastWeek: number
}>

type RecentRow = {
  id: string
  run_id: string
  name: string
  locality: string
  total: number
  opportunity_class: string
  review_status: string | null
  contact_available: number
  scored_at: number
}

type SummaryRow = {
  qualified: number
  unreviewed: number
  shortlisted: number
  top_score: number
  this_week: number
  last_week: number
}

const WEEK_IN_MILLISECONDS = 7 * 24 * 60 * 60 * 1000

const RECENT_CANDIDATE_LIMIT = 10

export function getRecentCandidates(): readonly RecentCandidate[] {
  return readCandidates((database) => {
    const rows = database
      .prepare(
        `select cs.id,rb.run_id,cb.name,cb.locality,cs.total,cs.scored_at,case when wi.status='Blocked' then 'LimitedWebsiteEvidence' else wo.opportunity_class end opportunity_class,crv.status review_status,exists(select 1 from contact_routes cr where cr.run_business_id=cs.run_business_id) contact_available from candidate_scores cs join run_businesses rb on rb.id=cs.run_business_id join canonical_businesses cb on cb.id=cs.canonical_business_id join website_assessments wa on wa.id=cs.assessment_id join website_inspections wi on wi.id=wa.inspection_id join website_opportunities wo on wo.id=(select id from website_opportunities where assessment_id=wa.id order by severity desc,confidence desc,sequence limit 1) left join candidate_reviews crv on crv.score_id=cs.id left join suppression_entries se on se.identity_fingerprint=cb.identity_fingerprint where cs.qualified=1 and se.identity_fingerprint is null and ${CURRENT_SCORE_PER_BUSINESS} order by cs.scored_at desc,cs.total desc,cs.id limit ?`,
      )
      .all(RECENT_CANDIDATE_LIMIT) as RecentRow[]
    return rows.map((row) => ({
      id: row.id,
      runId: row.run_id,
      name: row.name,
      locality: row.locality,
      score: row.total,
      primaryOpportunity: row.opportunity_class,
      reviewStatus: row.review_status ?? "Unreviewed",
      contactAvailable: Boolean(row.contact_available),
      scoredAt: new Date(row.scored_at).toISOString(),
    }))
  })
}

export function getCandidateSummary(now = new Date()): CandidateSummary {
  const weekAgo = now.getTime() - WEEK_IN_MILLISECONDS
  const twoWeeksAgo = weekAgo - WEEK_IN_MILLISECONDS
  return readCandidates((database) => {
    const row = database
      .prepare(
        `select count(*) qualified,coalesce(sum(case when coalesce(crv.status,'Unreviewed')='Unreviewed' then 1 else 0 end),0) unreviewed,coalesce(sum(case when crv.status='Shortlisted' then 1 else 0 end),0) shortlisted,coalesce(max(cs.total),0) top_score,coalesce(sum(case when cs.scored_at>? then 1 else 0 end),0) this_week,coalesce(sum(case when cs.scored_at>? and cs.scored_at<=? then 1 else 0 end),0) last_week from candidate_scores cs join canonical_businesses cb on cb.id=cs.canonical_business_id left join candidate_reviews crv on crv.score_id=cs.id left join suppression_entries se on se.identity_fingerprint=cb.identity_fingerprint where cs.qualified=1 and se.identity_fingerprint is null`,
      )
      .get(weekAgo, twoWeeksAgo, weekAgo) as SummaryRow | undefined
    if (!row) return emptyCandidateSummary
    return {
      qualified: row.qualified,
      unreviewed: row.unreviewed,
      shortlisted: row.shortlisted,
      topScore: row.top_score,
      qualifiedThisWeek: row.this_week,
      qualifiedLastWeek: row.last_week,
    }
  })
}

const emptyCandidateSummary: CandidateSummary = {
  qualified: 0,
  unreviewed: 0,
  shortlisted: 0,
  topScore: 0,
  qualifiedThisWeek: 0,
  qualifiedLastWeek: 0,
}

export type ReassessmentTarget = Readonly<{
  discoveredBusinessId: string
  businessName: string
  sourceSearchBrief: unknown
}>

// Reassessment repeats the brief that found the business, so the run keeps the same market and runtime.
export function getReassessmentTarget(scoreId: string): ReassessmentTarget | undefined {
  return readCandidates((database) => {
    const row = database
      .prepare(
        `select rb.discovered_business_id,cb.name,pr.search_brief from candidate_scores cs join run_businesses rb on rb.id=cs.run_business_id join canonical_businesses cb on cb.id=cs.canonical_business_id join prospecting_runs pr on pr.id=cs.run_id where cs.id=?`,
      )
      .get(scoreId) as
      | { discovered_business_id: string; name: string; search_brief: string }
      | undefined
    if (!row) return undefined
    try {
      return {
        discoveredBusinessId: row.discovered_business_id,
        businessName: row.name,
        sourceSearchBrief: JSON.parse(row.search_brief) as unknown,
      }
    } catch {
      return undefined
    }
  })
}

function readCandidates<T>(read: (database: Database.Database) => T): T {
  let db: Database.Database | undefined
  try {
    const database = new Database(loadLocalApplicationConfig().databasePath, {
      readonly: true,
      fileMustExist: true,
    })
    db = database
    return read(database)
  } finally {
    db?.close()
  }
}
