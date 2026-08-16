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
  observations: readonly string[]
  breakdown: Readonly<{
    severity: number
    confidence: number
    contact: number
    localDecision: number
    commercialValue: number
  }>
  rubricVersion: string
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
}

export function getReviewQueue(): readonly QueueCandidate[] {
  let db: Database.Database | undefined
  try {
    db = new Database(loadLocalApplicationConfig().databasePath, {
      readonly: true,
      fileMustExist: true,
    })
    const rows = db
      .prepare(
        `select cs.id,cb.name,cb.locality,cs.total,cs.severity_component,cs.confidence_component,cs.contact_component,cs.local_decision_component,cs.commercial_value_component,cs.rubric_version,wo.opportunity_class,wo.confidence,wi.status inspection_state,exists(select 1 from online_presences op where op.run_business_id=cs.run_business_id and op.type='Website' and op.association_state='Confirmed') website_available,exists(select 1 from contact_routes cr where cr.run_business_id=cs.run_business_id) contact_available from candidate_scores cs join canonical_businesses cb on cb.id=cs.canonical_business_id join website_assessments wa on wa.id=cs.assessment_id join website_inspections wi on wi.id=wa.inspection_id join website_opportunities wo on wo.id=(select id from website_opportunities where assessment_id=wa.id order by severity desc,confidence desc,sequence limit 1) where cs.qualified=1 order by cs.total desc,cb.name collate nocase,cs.id`,
      )
      .all() as QueueRow[]
    const observations = db.prepare(
      `select so.statement from supporting_observations so join website_opportunities wo on wo.id=so.opportunity_id join candidate_scores cs on cs.assessment_id=wo.assessment_id where cs.id=? order by wo.severity desc,so.confidence desc,so.sequence limit 2`,
    )
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
      reviewStatus: "Unreviewed",
      observations: (observations.all(row.id) as { statement: string }[]).map(
        (item) => item.statement,
      ),
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
