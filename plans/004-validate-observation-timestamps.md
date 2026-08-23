# Plan 004: Validate Observation Timestamps Against Evidence

> **Executor instructions**: Follow every step and verification. Stop on a stated STOP condition.
> Update Plan 004 in `plans/README.md` when complete.
>
> **Drift check (run first)**:
> `git diff --stat b060b46..HEAD -- src/features/website-assessment/application src/features/website-assessment/domain src/features/website-assessment/infrastructure`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `b060b46`, 2026-08-23

## Why This Matters

The assessment prompt requires each Supporting Observation to use its evidence item's observation
timestamp, but the decoder verifies only that the cited URL exists. Any syntactically valid invented
timestamp can be persisted, weakening the audit trail and the product promise that a claim retains
when it was observed. Validation must bind citation URL and timestamp together.

## Current State

```ts
// src/features/website-assessment/domain/assessment-output.ts:84-94
export function decodeAssessmentOutput(value: unknown, allowedSourceUrls: ReadonlySet<string>) {
  return Schema.decodeUnknown(AssessmentOutputSchema, { onExcessProperty: "error" })(value).pipe(
    // ...
    Effect.flatMap((output) => validateCitations(output, allowedSourceUrls)),
  )
}
```

`validateCitations` normalizes and checks `observation.sourceUrl` but does not inspect
`observation.observedAt`. `buildAssessmentPrompt` at `assessment-runtime.ts:77` explicitly tells the
runtime to use the evidence timestamp. Existing domain tests in `assessment-output.test.ts` are the
structural pattern to extend.

Constraints:

- Source Content remains untrusted.
- No timestamp is repaired or invented; invalid output is rejected and counted through existing
  runtime failure behavior.
- One URL may legitimately appear in multiple viewport/page evidence records with more than one
  allowed observation time.
- URL normalization behavior must remain consistent with current citation checks.

## Commands You Will Need

| Purpose | Command | Expected On Success |
|---|---|---|
| Domain tests | `pnpm test -- assessment-output` | all matching tests pass |
| Runtime tests | `pnpm test -- assessment-runtime subscription-assessment-runtimes` | all pass |
| Typecheck | `pnpm typecheck` | exit 0 |
| Full gate | `pnpm check` | exit 0 |

## Scope

**In scope**:

- `src/features/website-assessment/domain/assessment-output.ts`
- `src/features/website-assessment/domain/assessment-output.test.ts`
- Call sites that construct the allowed evidence citation collection
- Their colocated tests
- `CHANGELOG.md`

**Out of scope**:

- Changing the assessment JSON schema or prompt wording
- Rewriting persisted historical observations
- Relaxing exact source URL admission
- Adding date tolerance or substituting the current time

## Git Workflow

- Branch: `advisor/004-validate-observation-times`
- Final commit style: `fix(website-assessment): validate observation timestamps`
- Do not push unless instructed.

## Steps

### Step 1: Add Forged-Timestamp Regression Tests

Extend `assessment-output.test.ts` with an evidence citation map containing normalized URL and one or
more allowed ISO timestamps. Cover:

- Exact URL and timestamp pair succeeds.
- Allowed URL with an invented timestamp fails as `unsupported-claim`.
- Unknown URL with a valid timestamp fails.
- One URL with two legitimate evidence timestamps accepts either exact value.
- Equivalent URL normalization continues working without changing timestamp equality.

**Verify**: `pnpm test -- assessment-output` -> forged-timestamp test fails against old code.

### Step 2: Replace URL Set With A Citation Admission Map

Change `decodeAssessmentOutput` to receive a read-only map from normalized URL to a read-only set of
allowed timestamp strings, or an equivalently explicit `AllowedCitation` collection. Validate every
observation as a URL/timestamp pair. Keep existing error types unless a new error code materially
improves handling at an existing caller.

Update call sites to derive this collection directly from the evidence envelope supplied to the
runtime. Do not derive timestamps from runtime output.

**Verify**: `pnpm test -- assessment-output assessment-runtime subscription-assessment-runtimes` ->
all matching tests pass.

### Step 3: Run The Full Gate

Add an Unreleased fix entry stating that Supporting Observation times must now match supplied
evidence. Run the complete gate.

**Verify**: `pnpm check` -> exit 0.

## Test Plan

- Exact pair, forged timestamp, unknown URL, multiple allowed times, and URL normalization.
- Existing malformed, missing-citation, out-of-stage, and InsufficientEvidence cases remain green.
- Adapter tests prove the allowed map is created from the exact evidence envelope.

## Done Criteria

- [ ] Every accepted Supporting Observation matches an allowed normalized URL and exact observation time.
- [ ] No timestamp is repaired or defaulted.
- [ ] Existing citation and closed-schema validation remains intact.
- [ ] `pnpm check` exits 0.
- [ ] Only in-scope files and `plans/README.md` are modified.

## STOP Conditions

- The evidence envelope contains no observation time for a source that production currently accepts.
- Existing data uses non-ISO or lossy timestamp forms that require a migration decision.
- Correct validation requires widening source admission or changing prompt authority.

## Maintenance Notes

Future evidence types must add allowed URL/time pairs when constructing the assessment envelope.
Reviewers should reject tolerance windows unless the evidence capture layer itself loses precision
and that loss is documented.

