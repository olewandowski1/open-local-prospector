# Split Inspection Capture And Test Policy

Status: resolved

## Acceptance Criteria

- [x] Page capture/extraction concerns are separated from inspection orchestration.
- [x] Extracted navigation/redaction policy has direct fast unit coverage.
- [x] Existing inspection behavior and tests remain unchanged.
- [x] No CI command or browser project is added.

## Answer

Moved rendered-page fact extraction and its bounds to `playwright-page-facts.ts`, and moved relevant
journey selection and interstitial detection to `inspection-page-policy.ts`. Added direct unit tests
for same-site journey selection, Polish/English interstitials, credential removal, secret query
redaction, and unsafe URL logging. All focused inspection tests pass.
