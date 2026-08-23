# Give Codex A Valid Discovery Schema

Status: resolved

The first controlled Codex run spent 11.2 minutes in discovery and then paused as Runtime
Unavailable. Codex rejected `websiteUrl` because its output-schema contract requires every property
to be required; values that may be absent must instead be nullable.

## Acceptance

- [x] The runtime-facing discovery schema requires `websiteUrl` and permits `null`.
- [x] A `null` runtime value decodes to the domain's existing absent `websiteUrl` representation.
- [x] Discovery schema and runtime adapter tests pass.
- [x] A real Codex structuring call proceeds beyond structured-output schema validation.

## Answer

The runtime-facing schema now requires `websiteUrl` and permits either a URL or `null`. Runtime
`null` is normalized to the domain's existing absent property before strict decoding, so the change
does not leak a transport concern into application logic.

Verification:

- Discovery schema and subscription-runtime tests: 18 passed.
- A real Codex/Luna/Max structure-only call accepted the schema and returned 11 businesses from a
  persisted OpenCode report.
