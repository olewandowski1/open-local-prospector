# Product Requirements

Status: Living Document

## 1. Executive Summary

### Problem Statement

Independent local businesses are easy to list but difficult to qualify responsibly. Generic lead
sources mix local decision-makers with chains, provide little evidence about website quality, and
leave the user to repeat discovery, verification, and review by hand.

### Proposed Solution

Open Prospector is a single-user, local-first application that discovers independent
businesses for a bounded Search Brief, verifies their public Online Presence, inspects their
websites in a controlled browser, and ranks evidence-backed Website Opportunities for review. The
application owns orchestration, validation, scoring, safety, and persistence. Users bring their own
installed and authenticated Claude, Codex, or OpenCode client, choose one for each Search Brief, and
switch between ready runtimes whenever they want. The application does not perform provider login
or handle provider credentials. The selected runtime performs narrowly scoped search and
interpretation work.

### Success Criteria

- A user can create a Search Brief for any supported location and request 5–50 Candidate
  Businesses.
- Every qualified Candidate Business has a deterministic Opportunity Score and at least one
  Supporting Observation with a public source URL and observation time.
- The versioned identity evaluation fixtures maintain at least 90% precision.
- A Prospecting Run survives application restarts without repeating committed work.
- Review, correction, suppression, deletion, backup, restore, and export operate without outreach,
  cloud hosting, or usage-based API credentials.

## 2. User Experience And Functionality

### User Persona

The primary user is one person researching website opportunities for independent local businesses.
They value explainable evidence, control over local data, and a shortlist they can judge themselves.
They do not need a CRM, automated outreach, or a collaborative cloud workspace.

### User Journey

1. Confirm that local storage, Chromium, and at least one subscription runtime are ready.
2. Define a Search Brief with a Search Area, business category, target count, Run Mode, and runtime.
3. Review Run Preflight and explicitly confirm the interpreted Search Area.
4. Let the worker discover, deduplicate, corroborate, inspect, assess, and score businesses.
5. Monitor Run Progress and pause, resume, cancel, or recover work without losing checkpoints.
6. Review each Candidate Business with its evidence, score, contact routes, and inspection limits.
7. Record a decision, correct material facts, suppress a business, or export the reviewed result.

### User Stories And Acceptance Criteria

#### Configure The Local Application

As the user, I want one repeatable setup flow so that local dependencies and storage are prepared
without Docker or provider credentials in the application.

- The web server binds to `127.0.0.1`.
- Setup creates or migrates SQLite storage and installs the matching Playwright Chromium build.
- Runtime readiness echoes the installed clients' own status without reading or storing credentials.
- Local application and evidence data remain outside version control.

#### Define A Bounded Search

As the user, I want to choose where and what to search so that every run has a clear stopping point.

- A Search Brief requires a category, a confirmed Search Area, a target from 5 to 50, a Run Mode,
  and one ready runtime.
- Ambiguous locations require an explicit selection before a run can begin.
- Run Preflight reports readiness, estimated workload, and likely duration before confirmation.

#### Execute And Control A Run

As the user, I want long-running work to checkpoint and recover so that interruptions do not waste
completed discovery or assessment work.

- Every durable stage is represented in SQLite and claimed by the separate worker.
- Pausing and cancellation preserve completed work.
- An individual business failure produces a partial result or exclusion rather than failing the
  whole run.
- The final Run Completion State uses one recorded outcome from the domain language.

#### Review Evidence-Backed Candidates

As the user, I want every recommendation tied to observable evidence so that I can verify it before
acting.

- Candidates are ordered by deterministic Opportunity Score.
- Candidate detail shows Supporting Observations, source URLs, inspection limitations, contact
  routes, and score components.
- The user can shortlist, reject with a reason, mark contacted, archive, or reset a decision.
- Corrections preserve the previous machine result rather than rewriting history.

#### Control Local Data

As the user, I want explicit control over stored data so that the application remains genuinely
local-first.

- Backup and restore round-trip the SQLite workspace and evidence artifacts.
- Destructive reset, deletion, and cleanup actions require explicit confirmation.
- A Suppression Entry prevents future recommendation and export without becoming outreach data.
- CSV and JSON exports omit suppressed businesses and never initiate contact.

### Non-Goals

- Sending, scheduling, drafting, or automating outreach.
- CRM, pipeline automation, recurring monitoring, or multi-user collaboration.
- CAPTCHA solving, authentication bypass, or consumer search-result scraping.
- Paid datasets, named-person enrichment, or private account data.
- Cloud hosting, remote access, telemetry, or a metered AI fallback.
- Automatic prompt, threshold, or scoring-weight changes based on review decisions.

## 3. AI System Requirements

### Tool Requirements

- Discovery uses the selected Claude, Codex, or OpenCode runtime's public web-search capability.
- Website inspection uses application-owned Playwright Chromium, not provider browsing behavior.
- Structuring calls receive a bounded report with tools disabled and must satisfy a closed schema.
- Source Content is delimited untrusted data and cannot grant permissions or alter tool arguments.

### Runtime Authority

The runtime may search, classify, and explain within a stage-specific contract. It does not own run
limits, browser navigation policy, URL validation, identity fingerprints, eligibility,
deduplication, Opportunity Scores, retries, persistence, or state transitions. The application never
silently changes runtimes or falls back to a usage-based API.

### Evaluation Strategy

- Version prompt, schema, inspection, identity, and scoring behavior.
- Exercise Polish-language identity fixtures, ambiguous matches, chains, inaccessible websites,
  strong existing websites, and every Website Opportunity class.
- Reject uncited claims and URLs absent from the report supplied to the structuring call.
- Test restart recovery, bounded retries, partial inspection, and safe subprocess execution.
- Keep factual Technical Run Logs while excluding provider credentials and hidden reasoning.

## 4. Technical Specifications

### Architecture Overview

```text
Next.js Web Application  →  SQLite  ←  Effect Worker
          │                              │
          │                              ├─ Subscription Runtime Web Search
          │                              ├─ Structured Runtime Assessment
          └─ Review And Control          └─ Playwright Website Inspection
```

- Next.js App Router composes server-rendered pages and loopback Route Handlers.
- Product features own their domain, application, infrastructure, server, worker, and presentation
  layers behind narrow public interfaces.
- SQLite in WAL mode is the durable source of truth; evidence artifacts live on the local filesystem.
- Effect manages worker services, typed errors, interruption, retries, timeouts, and bounded
  concurrency without replacing durable workflow state.

### Integration Points

- Installed Claude, Codex, and OpenCode executables, invoked directly without a shell.
- Playwright-managed Chromium for public website inspection.
- OpenStreetMap Nominatim-compatible geocoding, called only by explicit preflight action.
- Local filesystem paths configured through non-secret environment variables.

### Security And Privacy

- Bind application traffic to loopback and block private-network browser destinations.
- Allow only public HTTP(S) navigation; block downloads, pop-ups, unsafe protocols, and unexpected
  navigation.
- Never persist provider credentials, runtime stderr, hidden reasoning, or unnecessary named-person
  data.
- Treat every website, directory, report, and snippet as untrusted evidence.
- Preserve source URLs and observation times while supporting deletion and suppression.

### Verification Gates

- `pnpm check` runs formatting and lint checks, feature-boundary checks, TypeScript, unit tests, and
  a production build.
- `pnpm worker:check` verifies the independent worker composition root.
- `pnpm test:e2e` exercises the synthetic desktop and mobile application workspace.
- `pnpm test:e2e:workspace` exercises destructive data operations in an isolated workspace.
- Live runtime comparisons run only through an explicit opt-in configuration.

## 5. Risks And Roadmap

### Current Product Boundary

The current product is the complete local workflow: readiness, bounded discovery, safe inspection,
evidence-backed assessment, deterministic scoring, resumable execution, review, correction,
suppression, export, and workspace administration.

### Near-Term Improvements

- Calibrate prompts and evaluation fixtures against repeated real runs without automatic tuning.
- Improve source coverage and runtime reliability while preserving bounded execution.
- Keep documentation screenshots and setup instructions synchronized with releases.

### Later, Only After Demonstrated Need

- Additional public discovery adapters behind existing feature boundaries.
- Desktop packaging or managed background startup.
- Collaborative or hosted operation with a deliberate persistence and privacy redesign.

### Technical Risks

| Risk | Consequence | Mitigation |
|---|---|---|
| Incorrect Business Identity | Evidence is attached to the wrong business | Corroborating signals, ambiguity states, precision fixtures, and user corrections |
| Runtime Search Variance | Yield or duration changes between runs | Bounded queries, visible exhaustion, repeated evaluation, and no silent fallback |
| Hostile Source Content | Prompt injection or unsafe navigation | Delimited evidence, closed schemas, URL validation, and network policy |
| Browser Blocking | Partial assessments | Record Inspection Blocks and preserve the evidence that remains available |
| SQLite Contention | Delayed or abandoned tasks | One worker, WAL, short transactions, leases, and startup recovery |
| Artifact Growth | Local disk pressure | Visible usage, configurable storage, backup, cleanup, and deletion controls |

## Supporting Documents

- [Domain Language](Domain-Language.md)
- [Architecture](Architecture.md)
- [Architecture Decision Records](adr/)
