import Database from "better-sqlite3"
import { loadLocalApplicationConfig } from "@/features/local-application"

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
  screenshots: readonly string[]
  measurements: readonly string[]
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

export function getReviewQueue(): readonly QueueCandidate[] {
  let db: Database.Database | undefined
  try {
    const database = new Database(loadLocalApplicationConfig().databasePath, {
      readonly: true,
      fileMustExist: true,
    })
    db = database
    const rows = database
      .prepare(
        `select cs.id,cs.run_business_id,cs.assessment_id,wa.inspection_id,cb.name,cb.locality,cs.total,cs.severity_component,cs.confidence_component,cs.contact_component,cs.local_decision_component,cs.commercial_value_component,cs.rubric_version,wo.opportunity_class,wo.confidence,wi.status inspection_state,exists(select 1 from online_presences op where op.run_business_id=cs.run_business_id and op.type='Website' and op.association_state='Confirmed') website_available,exists(select 1 from contact_routes cr where cr.run_business_id=cs.run_business_id) contact_available,crv.status review_status,crv.rejection_reason,crv.rejection_note,crv.private_notes,crv.follow_up_at from candidate_scores cs join canonical_businesses cb on cb.id=cs.canonical_business_id join website_assessments wa on wa.id=cs.assessment_id join website_inspections wi on wi.id=wa.inspection_id join website_opportunities wo on wo.id=(select id from website_opportunities where assessment_id=wa.id order by severity desc,confidence desc,sequence limit 1) left join candidate_reviews crv on crv.score_id=cs.id where cs.qualified=1 order by cs.total desc,cb.name collate nocase,cs.id`,
      )
      .all() as QueueRow[]
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
            "select path from inspection_artifacts where inspection_id=? and kind='Screenshot' order by created_at,id",
          )
          .all(row.inspection_id) as { path: string }[]
      ).map((item) => item.path),
      measurements: (
        database
          .prepare(
            "select measurements from inspection_pages where inspection_id=? order by sequence,viewport",
          )
          .all(row.inspection_id) as { measurements: string }[]
      ).map((item) => item.measurements),
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
  } catch {
    return []
  } finally {
    db?.close()
  }
}
