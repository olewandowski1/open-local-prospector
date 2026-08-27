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
    const filters: string[] = []
    const bindings: string[] = []
    if (input.statuses) {
      filters.push("and coalesce(cr.status,'Unreviewed') in (select value from json_each(?))")
      bindings.push(JSON.stringify([...new Set(input.statuses)]))
    }
    if (input.selectedIds) {
      filters.push("and cs.id in (select value from json_each(?))")
      bindings.push(JSON.stringify([...new Set(input.selectedIds)]))
    }
    const rows = db
      .prepare(
        `select cs.id,cb.name,cb.locality,cs.total,cs.rubric_version,cs.severity_component,cs.confidence_component,cs.contact_component,cs.local_decision_component,cs.commercial_value_component,wa.assessed_at,coalesce(cr.status,'Unreviewed') review_status,cs.run_business_id from candidate_scores cs join canonical_businesses cb on cb.id=cs.canonical_business_id join website_assessments wa on wa.id=cs.assessment_id left join candidate_reviews cr on cr.score_id=cs.id left join suppression_entries se on se.identity_fingerprint=cb.identity_fingerprint where cs.qualified=1 and se.identity_fingerprint is null ${filters.join(" ")} order by cs.total desc,cb.name collate nocase,cs.id`,
      )
      .all(...bindings) as ExportRow[]
    const evidenceByScore = readEvidenceByScore(
      db,
      rows.map((row) => row.id),
    )
    const contactsByBusiness = readContactsByBusiness(
      db,
      rows.map((row) => row.run_business_id),
    )
    const data = rows.map((row) =>
      mapExport(
        row,
        evidenceByScore.get(row.id) ?? [],
        contactsByBusiness.get(row.run_business_id) ?? [],
        input.includeNamedProfessionalContacts ?? false,
      ),
    )
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
type ContactRow = Readonly<{
  run_business_id: string
  type: string
  value: string
  source_url: string
}>

function readEvidenceByScore(
  db: Database.Database,
  scoreIds: readonly string[],
): ReadonlyMap<string, readonly string[]> {
  if (scoreIds.length === 0) return new Map()
  const rows = db
    .prepare(
      `select distinct cs.id score_id,so.source_url from supporting_observations so join website_opportunities wo on wo.id=so.opportunity_id join candidate_scores cs on cs.assessment_id=wo.assessment_id where cs.id in (select value from json_each(?)) order by cs.id,so.source_url`,
    )
    .all(JSON.stringify(scoreIds)) as { score_id: string; source_url: string }[]
  return groupRows(
    rows,
    (row) => row.score_id,
    (row) => row.source_url,
  )
}

function readContactsByBusiness(
  db: Database.Database,
  runBusinessIds: readonly string[],
): ReadonlyMap<string, readonly ContactRow[]> {
  if (runBusinessIds.length === 0) return new Map()
  const rows = db
    .prepare(
      `select run_business_id,type,value,source_url from contact_routes where run_business_id in (select value from json_each(?)) order by run_business_id,type,value,source_url`,
    )
    .all(JSON.stringify(runBusinessIds)) as ContactRow[]
  return groupRows(
    rows,
    (row) => row.run_business_id,
    (row) => row,
  )
}

function groupRows<Row, Value>(
  rows: readonly Row[],
  keyOf: (row: Row) => string,
  mapValue: (row: Row) => Value,
): ReadonlyMap<string, readonly Value[]> {
  const grouped = new Map<string, Value[]>()
  for (const row of rows) {
    const key = keyOf(row)
    const values = grouped.get(key) ?? []
    values.push(mapValue(row))
    grouped.set(key, values)
  }
  return grouped
}

function mapExport(
  row: ExportRow,
  evidenceLinks: readonly string[],
  contacts: readonly ContactRow[],
  includeNamed: boolean,
): CandidateExport {
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
    evidenceLinks,
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
  const raw = typeof value === "string" ? value : JSON.stringify(value)
  // Prefix formula-like source text because spreadsheet programs evaluate quoted cells.
  const text = /^\s*[=+\-@]/u.test(raw) ? `'${raw}` : raw
  return `"${text.replaceAll('"', '""')}"`
}
export function toCsv(data: readonly CandidateExport[]): string {
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
