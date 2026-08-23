# Split Search Brief Form And Test Presentation

Status: resolved

## Acceptance Criteria

- [x] Cohesive draft initialization and serialization move out of the Search Brief orchestration component.
- [x] Pure Search Brief draft presentation/serialization behavior has fast unit coverage.
- [x] Existing browser behavior remains unchanged.
- [x] No CI command or browser project is added.

## Answer

Extracted Search Brief presets, draft contracts, initialization, runtime fallback, and request
serialization into `search-brief-draft.ts`. Added three direct Vitest cases for presets, custom
categories, ready-runtime selection, numeric conversion, and optional radius omission. All four
existing desktop/mobile Search Brief browser tests pass.
