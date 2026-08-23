# Plan 005: Build Executable Quality Fixtures

> **Executor instructions**: This is a large test-infrastructure plan. Follow each gate and stop if
> fixture licensing, personal data, or runtime nondeterminism enters the normal test suite. Update
> Plan 005 in `plans/README.md` when complete.
>
> **Drift check (run first)**:
> `git diff --stat b060b46..HEAD -- src/features/mvp-evaluation src/features/business-discovery/domain src/features/business-identity/domain src/features/website-assessment/domain src/features/review-queue/infrastructure/score-candidate.ts docs/Product.md docs/Domain-Language.md`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: Plan 004
- **Category**: tests
- **Planned at**: commit `b060b46`, 2026-08-23

## Why This Matters

The product names incorrect Business Identity as its first technical risk and claims versioned
identity fixtures maintain at least 90% precision. The current test begins after the difficult
search-and-structure attribution step, while Website Opportunity fixtures only prove that metadata
arrays contain expected labels. Prompt, schema, verifier, and assessment regressions can therefore
pass the headline gate. This plan creates deterministic replay coverage without making provider
calls during `pnpm check`.

## Current State

- `src/features/mvp-evaluation/domain/evaluation-fixtures.ts:11-53` contains six small opportunity
  metadata records and two site-condition labels.
- `evaluation-fixtures.ts:55-57` explicitly states identity separation is measurable only by a live
  run; the 12 identity fixtures begin with already-structured `StructuredBusiness` values.
- `evaluation-fixtures.test.ts:32-49` calculates precision only for deterministic eligibility after
  structuring.
- `evaluation-fixtures.test.ts:52-64` manufactures valid observations inside the test rather than
  passing fixture evidence through production decoders/verifiers.
- ADR 0013 says reports, structured output, prompt version, and schema version are persisted so they
  can be explained and replayed. Match that vocabulary.

Do not commit real businesses, telephone numbers, named people, copied webpage text, provider hidden
reasoning, or credentials. Fixtures must be invented or deliberately redacted and legally safe.

## Commands You Will Need

| Purpose | Command | Expected On Success |
|---|---|---|
| Evaluation tests | `pnpm test -- mvp-evaluation` | all evaluation tests pass |
| Related domains | `pnpm test -- discovery-structure business-identity assessment-output` | all pass |
| Typecheck | `pnpm typecheck` | exit 0 |
| Full gate | `pnpm check` | exit 0 |

## Scope

**In scope**:

- `src/features/mvp-evaluation/` including new domain fixture modules and colocated tests
- Minimal public exports needed to invoke existing production decoders/verifiers/scorer inputs
- `docs/Product.md` only if verification wording must be made more precise
- `CHANGELOG.md`

**Out of scope**:

- Network access or provider CLI execution in `pnpm check`
- Real business or named-person data
- Automatic prompt/scoring changes
- Changing Opportunity Score weights or the qualification threshold
- A calibration UI or fixture capture/import UI
- The assembled worker flow, which belongs to Plan 006

## Git Workflow

- Branch: `advisor/005-executable-quality-fixtures`
- Commit in logical units because this is large; use messages such as
  `test(mvp-evaluation): replay structured attribution fixtures`.
- Do not push unless instructed.

## Steps

### Step 1: Define A Versioned, Redacted Fixture Contract

Create explicit fixture types for:

- Search report text and exact source URLs present in it.
- Candidate structured output, including expected accepted businesses and expected rejection reasons.
- Assessment evidence envelopes and runtime output objects.
- Expected identity status, canonical distinction/merge expectation, Website Opportunity classes,
  citation acceptance, score qualification, and relevant version identifiers.

Keep report and evidence payloads small and invented. Each fixture must state what production layer
it enters and what result is expected. Do not build a second implementation of production logic in
the evaluator.

**Verify**: `pnpm typecheck` -> exit 0 with fixture types exported only through the evaluation feature
unless a production public interface is genuinely required.

### Step 2: Replay Discovery Structure Verification

Feed fixture structured output through the production `decodeDiscoveryStructure` and the same report
verification used by discovery persistence. Add cases for:

- Two same-category, similar-name businesses kept separate.
- One shared directory page whose contacts belong to only one business.
- URL absent from the report rejected.
- Telephone absent from its cited report context rejected.
- Invalid national telephone number rejected.
- Source Content containing instruction-like text treated only as data.

Compute precision over accepted identity associations, not only eligibility after attribution. Keep
the 90% minimum, but also assert at least one accepted positive so an empty result cannot pass.

**Verify**: `pnpm test -- mvp-evaluation discovery-structure` -> all cases pass.

### Step 3: Replay Assessment And Scoring

Pass fixture runtime output through `decodeAssessmentOutput` using the URL/timestamp admission map
from Plan 004. Then invoke existing deterministic score calculation or the narrowest production
scoring function. Cover every Website Opportunity class, No Website, strong existing site,
inaccessible/partial inspection, insufficient evidence, uncited claim, forged timestamp, and a
qualification just below/at the threshold.

Assertions must compare categorical/quantitative outcomes, not exact prose generated by a provider.

**Verify**: `pnpm test -- mvp-evaluation assessment-output` -> all replay cases pass.

### Step 4: Report Versioned Metrics Clearly

Make the test output or a pure evaluator return:

- Fixture-set version.
- Prompt/schema/verifier/rubric version represented by the fixture.
- Accepted identity count and precision.
- Unsupported claim rejection count.
- Opportunity class coverage.
- Qualified/non-qualified score cases.

Tests must assert the metrics. Do not add telemetry or persist results outside test output.

**Verify**: `pnpm test -- mvp-evaluation` -> metrics assertions pass deterministically on repeated runs.

### Step 5: Replace Nominal Assertions And Run Full Verification

Remove or rewrite metadata-only assertions once executable equivalents cover them. Keep useful small
domain unit tests, but do not leave a second headline quality gate with weaker semantics. Update the
Product wording only if necessary to say precisely which layers the 90% metric covers.

Add an Unreleased changelog entry for the new executable quality gate.

**Verify**: run `pnpm test -- mvp-evaluation` twice, then `pnpm check`; all exit 0 with identical
metric results.

## Test Plan

- Attribution collision, ambiguous identity, chain, online-only, missing contact, and legitimate
  independent business cases.
- Every Website Opportunity class plus strong/inaccessible/no-site conditions.
- Unsupported URL, contact, claim, and timestamp rejection.
- Score below/at qualification threshold.
- Fixture contract itself rejects missing version metadata and accidental real contact patterns.

## Done Criteria

- [ ] The 90% precision gate exercises production attribution/verification, not only prestructured eligibility.
- [ ] Assessment fixtures run through production schema and citation validation.
- [ ] Every Website Opportunity class and named site condition is exercised behaviorally.
- [ ] Normal verification uses no network or provider runtime.
- [ ] Fixtures contain no real business, named-person, credential, or hidden-reasoning data.
- [ ] Two consecutive evaluation runs are deterministic.
- [ ] `pnpm check` exits 0.
- [ ] Only in-scope files and `plans/README.md` are modified.

## STOP Conditions

- A proposed fixture contains real personal/contact data or copyrighted page capture that cannot be
  safely committed.
- Production verification cannot be invoked without network/provider execution.
- Meeting the metric requires changing prompts, score weights, or thresholds rather than testing them.
- The definition of identity precision is ambiguous after reading Product, Domain Language, and ADR 0013.

## Maintenance Notes

Every prompt, schema, verifier, identity, or scoring change should update or deliberately confirm the
fixture version and metrics. Reviewers should reject snapshots of provider prose and tests that
reimplement production validation inside expectations.

