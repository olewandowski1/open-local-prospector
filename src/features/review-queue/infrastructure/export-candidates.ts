import Database from "better-sqlite3"

export type ExportFormat = "csv" | "json"
export type CandidateExport = Readonly<{
  business: string
  locality: string
  score: number
  rubricVersion: string
  assessmentTimestamp: string
  reviewStatus: string
  scoreBreakdown: Readonly<Record<string, number>>
  evidenceLinks: readonly string[]
  contactRoutes: readonly Readonly<{ type: string; value: string; sourceUrl: string }>[]
}>

export function exportCandidates(
  databasePath: string,
  input: Readonly<{
    format: ExportFormat
    statuses?: readonly string[]
    selectedIds?: readonly string[]
    includeNamedProfessionalContacts?: boolean
  }>,
): { contentType: string; filename: string; body: string } {
  const db = new Database(databasePath, { readonly: true, fileMustExist: true })
  try {
    const rows = db
      .prepare(
        `select cs.id,cb.name,cb.locality,cs.total,cs.rubric_version,cs.severity_component,cs.confidence_component,cs.contact_component,cs.local_decision_component,cs.commercial_value_component,wa.assessed_at,coalesce(cr.status,'Unreviewed') review_status,cs.run_business_id from candidate_scores cs join canonical_businesses cb on cb.id=cs.canonical_business_id join website_assessments wa on wa.id=cs.assessment_id left join candidate_reviews cr on cr.score_id=cs.id left join suppression_entries se on se.canonical_business_id=cs.canonical_business_id where cs.qualified=1 and se.canonical_business_id is null order by cs.total desc,cb.name collate nocase,cs.id`,
      )
      .all() as ExportRow[]
    const selected = input.selectedIds ? new Set(input.selectedIds) : undefined
    const statuses = input.statuses ? new Set(input.statuses) : undefined
    const data = rows
      .filter(
        (row) =>
          (!selected || selected.has(row.id)) && (!statuses || statuses.has(row.review_status)),
      )
      .map((row) => mapExport(db, row, input.includeNamedProfessionalContacts ?? false))
    return input.format === "json"
      ? {
          contentType: "application/json; charset=utf-8",
          filename: "open-local-prospector-candidates.json",
          body: JSON.stringify(data, null, 2),
        }
      : {
          contentType: "text/csv; charset=utf-8",
          filename: "open-local-prospector-candidates.csv",
          body: toCsv(data),
        }
  } finally {
    db.close()
  }
}

type ExportRow = {
  id: string
  name: string
  locality: string
  total: number
  rubric_version: string
  severity_component: number
  confidence_component: number
  contact_component: number
  local_decision_component: number
  commercial_value_component: number
  assessed_at: number
  review_status: string
  run_business_id: string
}
function mapExport(db: Database.Database, row: ExportRow, includeNamed: boolean): CandidateExport {
  const links = db
    .prepare(
      `select distinct so.source_url from supporting_observations so join website_opportunities wo on wo.id=so.opportunity_id join candidate_scores cs on cs.assessment_id=wo.assessment_id where cs.id=? order by so.source_url`,
    )
    .all(row.id) as { source_url: string }[]
  const contacts = db
    .prepare(
      "select type,value,source_url from contact_routes where run_business_id=? order by type,value,source_url",
    )
    .all(row.run_business_id) as { type: string; value: string; source_url: string }[]
  return {
    business: row.name,
    locality: row.locality,
    score: row.total,
    rubricVersion: row.rubric_version,
    assessmentTimestamp: new Date(row.assessed_at).toISOString(),
    reviewStatus: row.review_status,
    scoreBreakdown: {
      severity: row.severity_component,
      observationConfidence: row.confidence_component,
      contactRoute: row.contact_component,
      localDecisionLikelihood: row.local_decision_component,
      apparentCommercialValue: row.commercial_value_component,
    },
    evidenceLinks: links.map((link) => link.source_url),
    contactRoutes: contacts
      .filter((contact) => includeNamed || contact.type !== "NamedProfessional")
      .map((contact) => ({
        type: contact.type,
        value: contact.value,
        sourceUrl: contact.source_url,
      })),
  }
}
function csv(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value)
  return `"${text.replaceAll('"', '""')}"`
}
function toCsv(data: readonly CandidateExport[]): string {
  const header = [
    "business",
    "locality",
    "score",
    "rubricVersion",
    "assessmentTimestamp",
    "reviewStatus",
    "scoreBreakdown",
    "evidenceLinks",
    "contactRoutes",
  ]
  return [
    header.join(","),
    ...data.map((item) => header.map((key) => csv(item[key as keyof CandidateExport])).join(",")),
  ].join("\r\n")
}
