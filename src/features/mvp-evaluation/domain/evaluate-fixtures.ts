import { Effect } from "effect"
import { decodeDiscoveryStructure, verifyAgainstReport } from "@/features/business-discovery"
import { evaluateBusinessIdentity } from "@/features/business-identity"
import {
  assertQualityFixtureContract,
  qualityFixtures,
} from "@/features/mvp-evaluation/domain/evaluation-fixtures"
import { calculateOpportunityScore, qualifiesOpportunityScore } from "@/features/review-queue"
import {
  applyAssessmentEvidenceLimits,
  assessmentCitations,
  decodeAssessmentOutput,
} from "@/features/website-assessment"

type IdentityResult = Readonly<{
  name: string
  expectedStatus: "Eligible" | "Ambiguous" | "Excluded" | "Dropped"
  actualStatus: "Eligible" | "Ambiguous" | "Excluded" | "Dropped"
  associationCorrect: boolean
  canonicalFingerprint?: string
}>

type AssessmentResult = Readonly<{
  id: string
  accepted: boolean
  errorCode?: string
  opportunityClass?: string
  score?: number
  qualified?: boolean
}>

export type QualityEvaluation = Readonly<{
  versions: typeof qualityFixtures.versions
  discoveryResults: readonly Readonly<{
    id: string
    identities: readonly IdentityResult[]
    rejectionReasons: readonly string[]
  }>[]
  assessmentResults: readonly AssessmentResult[]
  metrics: Readonly<{
    acceptedIdentityCount: number
    correctIdentityCount: number
    identityPrecision: number
    unsupportedClaimRejectionCount: number
    opportunityClassCoverage: readonly string[]
    qualifiedCases: number
    nonQualifiedCases: number
  }>
}>

export async function evaluateQualityFixtures(): Promise<QualityEvaluation> {
  assertQualityFixtureContract(qualityFixtures)
  const discoveryResults: QualityEvaluation["discoveryResults"][number][] = []

  for (const fixture of qualityFixtures.discovery) {
    const decoded = await Effect.runPromise(decodeDiscoveryStructure(fixture.structuredOutput))
    const verified = verifyAgainstReport(decoded, fixture.report, "PL", isSyntheticPublicUrl)
    const businesses = new Map(verified.businesses.map((business) => [business.name, business]))
    const identities = fixture.expectedIdentities.map((expectation): IdentityResult => {
      const business = businesses.get(expectation.name)
      if (!business) {
        return {
          name: expectation.name,
          expectedStatus: expectation.status,
          actualStatus: "Dropped",
          associationCorrect: expectation.associationCorrect,
        }
      }
      const identity = evaluateBusinessIdentity({
        business,
        countryCode: "PL",
        collectedAt: new Date("2026-08-16T10:00:00.000Z"),
      })
      return {
        name: expectation.name,
        expectedStatus: expectation.status,
        actualStatus: identity.status,
        associationCorrect: expectation.associationCorrect,
        ...(identity.canonicalFingerprint
          ? { canonicalFingerprint: identity.canonicalFingerprint }
          : {}),
      }
    })
    discoveryResults.push({
      id: fixture.id,
      identities,
      rejectionReasons: verified.rejections.map((rejection) => rejection.reason),
    })
  }

  const assessmentResults: AssessmentResult[] = []
  for (const fixture of qualityFixtures.assessments) {
    const decoded = await Effect.runPromise(
      Effect.either(
        decodeAssessmentOutput(fixture.runtimeOutput, assessmentCitations(fixture.evidence)),
      ),
    )
    if (decoded._tag === "Left") {
      assessmentResults.push({ id: fixture.id, accepted: false, errorCode: decoded.left.code })
      continue
    }
    const output = applyAssessmentEvidenceLimits(fixture.evidence, decoded.right)
    const opportunities = output.opportunities
    const observations = opportunities.flatMap((opportunity) => opportunity.observations)
    const score = calculateOpportunityScore({
      severity: Math.max(0, ...opportunities.map((opportunity) => opportunity.severity)),
      observedPages: fixture.evidence.pages.map((page) => ({
        unlabeledControls: numeric(page.measurements.unlabeledControls),
        imagesMissingAlt: numeric(page.measurements.imagesMissingAlt),
        horizontalOverflow: Boolean(page.measurements.horizontalOverflow),
        usesHttps: page.measurements.usesHttps !== false,
        firstContentfulPaintMs: numeric(page.measurements.firstContentfulPaintMs),
      })),
      hasContactRoute: fixture.evidence.business.hasPublicContactRoute,
      localDecisionLikelihood: 1,
      apparentCommercialValue: output.apparentCommercialValue,
      inspectionState:
        fixture.evidence.business.websiteState === "Present"
          ? fixture.evidence.inspectionBlocks.length > 0
            ? "Partial"
            : "Complete"
          : fixture.evidence.business.websiteState,
    })
    assessmentResults.push({
      id: fixture.id,
      accepted: true,
      ...(opportunities[0] ? { opportunityClass: opportunities[0].class } : {}),
      score: score.total,
      qualified: qualifiesOpportunityScore(score, {
        hasOpportunity: opportunities.length > 0,
        hasObservation: observations.length > 0,
        hasContactRoute: fixture.evidence.business.hasPublicContactRoute,
        suppressed: false,
      }),
    })
  }

  const eligibleIdentities = discoveryResults
    .flatMap((result) => result.identities)
    .filter((identity) => identity.actualStatus === "Eligible")
  const correctIdentities = eligibleIdentities.filter((identity) => identity.associationCorrect)
  const acceptedAssessments = assessmentResults.filter((result) => result.accepted)
  return {
    versions: qualityFixtures.versions,
    discoveryResults,
    assessmentResults,
    metrics: {
      acceptedIdentityCount: eligibleIdentities.length,
      correctIdentityCount: correctIdentities.length,
      identityPrecision:
        eligibleIdentities.length === 0 ? 0 : correctIdentities.length / eligibleIdentities.length,
      unsupportedClaimRejectionCount: assessmentResults.filter(
        (result) => result.errorCode === "unsupported-claim",
      ).length,
      opportunityClassCoverage: [
        ...new Set(
          acceptedAssessments.flatMap((result) =>
            result.opportunityClass ? [result.opportunityClass] : [],
          ),
        ),
      ].sort(),
      qualifiedCases: acceptedAssessments.filter((result) => result.qualified).length,
      nonQualifiedCases: acceptedAssessments.filter((result) => result.qualified === false).length,
    },
  }
}

function isSyntheticPublicUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return ["http:", "https:"].includes(url.protocol) && url.hostname.endsWith(".test")
  } catch {
    return false
  }
}

function numeric(value: number | boolean | undefined): number {
  return typeof value === "number" ? value : 0
}
