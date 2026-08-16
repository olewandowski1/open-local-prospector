# Open Local Prospector — Product Requirements Document

## 1. Executive Summary

### Problem Statement

Finding independent local businesses that genuinely need a new or improved website requires repetitive searching, identity matching, site inspection, and evidence gathering. Existing lead lists do not explain the website opportunity and often mix in chains, poor identity matches, or contacts whose decisions are not made locally.

### Proposed Solution

Open Local Prospector is a single-user, local-first web application that discovers businesses for a selected location and category, inspects their public online presence, and ranks evidence-backed website opportunities for Oliver to review. It uses locally installed Codex, Claude Code, or OpenCode command-line runtimes through existing subscriptions while the application retains control of search, browser inspection, validation, scoring, persistence, and safety.

### Success Criteria

- At least 90% of confirmed business-to-website associations are correct in the versioned evaluation set.
- Every reported Website Opportunity cites at least one source-linked Supporting Observation; unsupported contact details are never produced.
- Centrally controlled chains, centrally controlled franchises, online-only businesses, and businesses without a public Contact Route do not enter the Review Queue.
- At least 30% of the first 30–50 reviewed Candidate Businesses are Shortlisted; this is a provisional calibration target, not a product claim.
- A normal Quick run targeting 10 qualified candidates is instrumented toward an approximately 15-minute completion target without treating it as a guaranteed service level.

## 2. User Experience & Functionality

### User Personas

**Primary persona — Oliver**

Oliver is a frontend developer with more than four years of professional experience at SolDevelo. He is interested in websites, performance, SEO, business presentation, and conversion-focused landing pages. He uses the product locally to find independent businesses he may later contact personally. He is the only v1 application user.

### User Flow

1. Oliver installs project dependencies and authenticates at least one supported provider CLI in a terminal.
2. The first-run checklist verifies SQLite, Playwright, disk space, and subscription-runtime readiness.
3. Oliver selects a city or municipality, confirms the interpreted Search Area, chooses one category, selects 5–50 candidates, a Run Mode, and one AI runtime.
4. Run Preflight reports readiness and estimated workload before Oliver starts the Prospecting Run.
5. The background worker discovers, deduplicates, corroborates, inspects, assesses, scores, and persists businesses through staged checkpoints.
6. Oliver watches application-generated progress, pauses or cancels if needed, and may inspect partial results.
7. Oliver reviews ranked candidates, evidence, screenshots, measurements, sources, identity uncertainty, and score explanations in the Review Workspace.
8. Oliver corrects records, adds private notes, changes Review Status, suppresses contacts where necessary, and exports reviewed data to CSV or JSON.

### User Stories

#### Story 1 — Configure a local installation

As Oliver, I want to see whether the local dependencies and provider runtimes are ready so that I can resolve setup problems without exposing credentials to the application.

**Acceptance Criteria**

- `pnpm install`, `pnpm run setup`, and `pnpm dev` are sufficient project commands for a documented local setup.
- Docker is not required.
- Setup creates or migrates the SQLite database, installs/checks Playwright Chromium, creates ignored local directories, and generates non-secret configuration templates.
- Settings reports dependencies as Ready, Missing, Logged Out, Unreachable, or Unsupported Version.
- The application provides terminal instructions but never performs provider login, reads provider tokens, or stores provider credentials.
- The web server binds to `127.0.0.1` unless the user explicitly changes the configuration.

#### Story 2 — Define a bounded search

As Oliver, I want to define a location, category, target count, depth, and runtime so that the run has a clear and controllable scope.

**Acceptance Criteria**

- A Search Brief accepts a city or municipality, optional radius, one predefined or custom category, and a target from 5 through 50 Candidate Businesses.
- Ambiguous geocoding requires explicit confirmation and displays the interpreted Search Area.
- Poland is the initial focus, but the interface does not reject other locations.
- Quick mode inspects the homepage and the primary conversion page; Thorough mode inspects up to five relevant pages.
- The runtime selector supports ready Codex, Claude Code, and OpenCode adapters, remembers the previous choice, and shows readiness.
- Recently assessed businesses are skipped by default; include-without-reassessment and explicit reassessment are separate choices.

#### Story 3 — Run and control prospecting

As Oliver, I want a run to continue safely in the background and survive restarts so that partial work is not lost.

**Acceptance Criteria**

- The worker persists every stage transition and per-business checkpoint in SQLite.
- SQLite uses WAL mode, foreign keys, a busy timeout, and short write transactions.
- Startup returns abandoned in-progress work to a resumable state without repeating completed stages unnecessarily.
- Default inspection concurrency is two and can be configured from one through four.
- Transient per-business failures are retried at most twice; permanent access barriers produce partial results.
- Pause finishes the active atomic step before stopping new work. Cancel preserves completed results and prevents new work.
- Completion is one of Target Reached, Search Exhausted, Cancelled with Partial Results, Paused, Runtime Unavailable, Completed with Warnings, or Infrastructure Failed.
- One failed business cannot alone fail the Prospecting Run.

#### Story 4 — Understand run progress

As Oliver, I want transparent progress without model chain-of-thought so that I can understand what the application has completed and why work stopped.

**Acceptance Criteria**

- The progress view shows current stage and counts for queries, discovered businesses, duplicates, exclusions, websites, completed assessments, qualified candidates, blocked or partial inspections, and target remaining.
- A business can be expanded to show its current stage, source events, retry count, and failure or exclusion reason.
- Generated search queries, source identifiers, timestamps, result URLs, transitions, and errors are retained in a separate Technical Run Log.
- The UI never labels model reasoning tokens, hidden reasoning, or generated prose as an execution log.

#### Story 5 — Receive evidence-backed candidates

As Oliver, I want candidates to include corroborated identity and observable website evidence so that I do not waste time on incorrect or unsupported recommendations.

**Acceptance Criteria**

- Business Identity uses corroborating signals such as name, location, address, phone, and reciprocal links; ambiguous associations are visibly flagged rather than confirmed.
- Eligible candidates are independent local businesses or small regional businesses whose website decisions are likely local.
- National chains, centrally controlled franchises, online-only businesses, and businesses without public Contact Routes are excluded with a retained reason.
- Search snippets may support discovery but never substitute for visiting the business website.
- Every Website Opportunity has one or more Supporting Observations with source URL, timestamp, and Evidence State.
- Aesthetic judgments are accepted only when tied to observable effects such as legibility, hierarchy, layout, trust, content clarity, or conversion flow.
- No-site candidates still require corroborated identity, evidence of current activity, local decision likelihood, and a public Contact Route.

#### Story 6 — Review and correct candidates

As Oliver, I want to compare evidence and correct machine output so that the canonical business record reflects my judgment without destroying history.

**Acceptance Criteria**

- The Review Workspace uses a ranked list and persistent detail pane.
- Candidate summaries include identity, location, Opportunity Score, primary opportunity, website/contact availability, confidence, inspection state, Review Status, and two leading observations.
- Details include score breakdown, opportunities, observations, desktop/mobile screenshots, measurements, Online Presence, Contact Routes, sources, and inspection limitations.
- Evidence is visibly categorized as confirmed fact, AI assessment, ambiguous identity, missing evidence, or Inspection Block.
- User Corrections may change identity links, presence links, contacts, classifications, and observations while preserving the original assessment in history.
- Review Status supports Unreviewed, Shortlisted, Rejected, Contacted, and Archived. Rejected requires a predefined reason or Other with a note.
- Private Review Notes and an optional follow-up date do not initiate outreach or infer status.

#### Story 7 — Filter and export reviewed results

As Oliver, I want to filter and export candidate data so that I can use reviewed results outside the application.

**Acceptance Criteria**

- Filters include category, location, opportunity class, score range, review status, website availability, Contact Route type, confidence, runtime, and run date.
- Sorting supports Opportunity Score, newest assessment, business name, and distance when coordinates are available.
- CSV and JSON exports include evidence links, score breakdown and rubric version, assessment timestamp, Review Status, and selected Contact Routes.
- Suppressed records are always excluded.
- Named professional contact data is excluded by default and requires an explicit inclusion choice.
- Export performs no outreach and does not mark a candidate Contacted.

#### Story 8 — Control local data

As Oliver, I want to back up, restore, clean up, suppress, and delete local data so that I retain control over stored business information and disk usage.

**Acceptance Criteria**

- An Application Backup packages SQLite, artifacts, and non-secret configuration but never secrets or provider authentication material.
- Restore validates compatibility before replacing active local state.
- Deleting a run removes its association while retaining canonical businesses referenced elsewhere.
- Deleting a business removes its assessments, notes, and artifacts except for a minimal required Suppression Entry.
- Reset requires typed confirmation and offers a backup first.
- Settings shows artifact disk usage and offers explicit cleanup for archived or deleted records.
- Suppression prevents future recommendation, reassessment for outreach, and export across all runs.

### Initial Category Presets

- Restaurants and cafés
- Beauty and wellness
- Fitness and recreation
- Home services and trades
- Automotive services
- Professional services
- Education and tutoring
- Events and hospitality
- Local retail and showrooms
- Healthcare practices
- Accommodation
- Custom category

### Non-Goals

- Sending, scheduling, or drafting email, phone, form, or social outreach.
- CRM automation, inferred pipeline stages, or automated follow-up.
- Authenticated social browsing, CAPTCHA bypass, access-control bypass, or consumer search-result scraping.
- Paid/private business datasets or private account data.
- Automatic recurring runs or monitoring.
- Cloud hosting, multi-user collaboration, remote access, application accounts, Electron packaging, or a system service.
- Automatic prompt, scoring-weight, or threshold modification from user feedback.
- Full GDPR/outreach-compliance workflow, consent management, privacy-notice generation, or named-person enrichment.
- Public map, directory, portal, or first-party social connectors in the first working slice.
- OpenRouter or usage-based API credentials as a requirement for v1.

## 3. AI System Requirements

### Workflow and Authority

The application orchestrates a fixed, checkpointed pipeline:

1. Interpret the Search Brief and create application-bounded queries.
2. Discover businesses through configured `DiscoverySource` adapters.
3. Normalize and deduplicate Discovered Businesses.
4. Corroborate Business Identity and eligibility.
5. Discover websites, social profiles, and Contact Routes.
6. Inspect the actual website with application-owned Playwright.
7. Extract deterministic page facts and technical measurements.
8. Ask the selected runtime for schema-constrained classifications, severity, confidence, and observations.
9. Validate runtime output and reject unsupported or out-of-stage actions.
10. Calculate Opportunity Score in versioned application code and persist the result.

AI runtimes do not own discovery, browser navigation, persistence, scoring, run limits, retries, or state transitions. A runtime cannot contact a business or invoke a general shell/browser/database tool.

### Tool Requirements

- **Subscription runtime web search:** the selected Codex, Claude Code, or OpenCode CLI is the only discovery connector, behind `DiscoverySource`; no separate search API key is required.
- **Geocoder:** resolves and confirms Search Areas; provider remains an implementation choice and must respect its terms and rate limits.
- **Playwright Chromium:** application-owned desktop/mobile inspection using an isolated temporary profile.
- **Deterministic measurements:** Lighthouse-style performance and page-quality measurements generated by code, never invented by AI.
- **Runtime adapters:** minimal local subprocess adapters for Codex, Claude Code, and OpenCode non-interactive modes.
- **SQLite and filesystem:** canonical records, checkpoints, versions, review decisions, artifact metadata, screenshots, and measurement files.

### Runtime Contract

- Each Prospecting Run selects exactly one runtime unless Oliver explicitly resumes with another; the change is recorded.
- Runtime executables are launched directly with no shell and fixed application-owned arguments.
- Stage prompts and Source Content are sent through standard input, never interpolated into executable names, arguments, environment variables, commands, or paths.
- Output must match a versioned schema. Invalid output is retried only within the stage policy and otherwise becomes a visible runtime failure.
- The application never reads, copies, parses, persists, or sends provider authentication tokens.
- Runtime failure pauses affected work and never silently switches provider or invokes an API fallback.
- A later Vercel AI SDK/OpenRouter adapter requires explicit configuration and per-run approval before usage-based spending.

### Inspection Requirements

- Quick mode visits the homepage plus the most relevant enquiry, booking, service, or purchasing page.
- Thorough mode visits up to five relevant pages.
- Capture desktop and mobile screenshots, rendered text, metadata, links, forms, console/network failures needed for assessment, timestamps, and final URLs.
- When the runtime supports vision, it may assess screenshots; otherwise screenshots remain available for manual review.
- Block localhost, loopback aliases, private/link-local network ranges, file/custom protocols, downloads, pop-ups, and unexpected cross-origin navigation.
- Follow only HTTP(S) resources needed to render approved public pages.
- Do not bypass authentication, CAPTCHAs, rate limits, robots/access controls, or platform interstitials.

### Scoring Requirements

The runtime returns structured inputs; application code calculates a versioned 0–100 score:

| Component | Weight |
|---|---:|
| Website Opportunity severity | 40% |
| Supporting Observation confidence | 25% |
| Contact Route availability | 15% |
| Local decision-making likelihood | 10% |
| Apparent commercial value | 10% |

The initial Review Queue threshold is 60. No-site status never guarantees qualification or top rank. Global weights remain consistent across categories; category guidance may change interpretation without silently changing weights.

### Evaluation Strategy

- Maintain versioned Evaluation Fixtures for Polish content, correct and ambiguous identities, false-positive identities, no-site businesses, strong existing sites, inaccessible sites, and each Website Opportunity class.
- Require 100% citation presence for emitted opportunities and zero inferred/generated contacts in fixtures.
- Target at least 90% Identity Precision before v1 completion.
- Track Shortlist Yield, rejection reasons, evidence corrections, inspection-block frequency, stage duration, retries, and runtime/schema failures.
- Re-run fixtures whenever prompts, extraction schemas, scoring rubrics, inspection configuration, or runtime adapters change.
- Store prompt, schema, rubric, and inspection versions on every Website Assessment.
- Review Examples may support an explicit proposed change; they never modify the system automatically.

## 4. Technical Specifications

### Architecture Overview

```text
Normal browser
    |
    v
Next.js host process ---------------> SQLite (WAL)
    |                                      ^
    | commands/read models                 | checkpoints/results
    v                                      |
Background worker -------------------------+
    |             |              |
    v             v              v
Runtime Search Playwright     RuntimeAdapter
API            Chromium       |-- Codex CLI
                               |-- Claude Code CLI
                               `-- OpenCode CLI

Artifacts: ignored local filesystem directory
```

The web process owns UI/API requests. The Effect-powered worker owns long-running jobs, stage transitions, browser inspection, and most writes. Both start through one development command but remain separate processes so a UI restart does not cancel durable work. SQLite, not the Effect runtime, is the durable workflow source of truth.

### Technology Stack

| Concern | Choice |
|---|---|
| Web framework | Next.js App Router, React, and TypeScript |
| UI | Tailwind CSS, shadcn/ui (Base UI), and selective 7Ovr registry blocks |
| Client data synchronization | TanStack Query with short-interval polling for run progress |
| Worker and server-domain execution | Pinned stable Effect v3 and `@effect/platform-node` |
| Runtime validation | Effect Schema for commands, persisted stage data, and AI-runtime output |
| Persistence | Drizzle ORM and Drizzle Kit over `better-sqlite3` |
| Browser inspection | Playwright Chromium |
| Testing | Vitest for domain/worker integration tests and Playwright for UI flows |

The React presentation layer remains conventional and does not use Effect for component state. Thin Next.js Route Handlers translate HTTP input into domain commands and run a provided Effect at one boundary. The worker starts through a Node runtime entry point and interprets each claimed SQLite task as a scoped Effect program.

7Ovr is an optional design accelerator, not a second component system. Blocks are installed through the shadcn registry, inspected, and adapted to the product domain. Canonical shadcn primitives, semantic theme tokens, local assets, accessibility, responsive behavior, and repository conventions remain authoritative; third-party block code is never accepted without review. Project-scoped shadcn MCP configuration is provided for Codex, Claude Code, and OpenCode-compatible clients.

Effect provides typed failures, services and Layers, bounded concurrency, interruption, timeouts, retry schedules, resource scopes, configuration, and structured local logging. Separate general-purpose libraries for retry, concurrency limiting, dependency injection, and worker logging are not introduced unless a demonstrated gap requires them. Experimental Effect workflows and clustering are excluded from v1.

### Persistence

- One configurable SQLite database file, stored outside source-controlled paths.
- WAL mode, foreign keys, busy timeout, short transactions, and transactional job claiming.
- Task rows contain stage, business association, status, attempt count, lease owner/expiry, timestamps, schema versions, and structured failure information.
- The Effect worker claims a task in a short transaction, executes outside the transaction, renews a time-limited lease when required, and atomically commits its checkpoint or classified failure.
- Canonical Business Identity across runs with immutable historical Website Assessments.
- Filesystem artifacts referenced through database metadata; whole websites are not copied.
- Core repositories isolate persistence sufficiently to permit a future PostgreSQL migration without changing product-domain behavior.

### Integration Points

- **Web discovery:** uses the selected authenticated subscription CLI with schema-constrained output; no dedicated search credential is stored.
- **Provider CLIs:** installed and authenticated externally; readiness determined only through supported executable/status behavior.
- **Playwright:** dedicated temporary profile with no personal cookies, extensions, credentials, history, or downloads.
- **Geocoding:** adapter-owned HTTP integration with cached interpretations and explicit ambiguity handling.
- **Exports:** local CSV and JSON generation only.

### Application Configuration

- Node.js current LTS and pnpm.
- `pnpm run setup` prepares SQLite, migrations, Playwright, local directories, and configuration templates. The explicit `run` is required because `pnpm setup` is a reserved pnpm command.
- `.env.local` holds only local paths and optional future configuration and is ignored by version control.
- Runtime choice, run defaults, concurrency, artifact path, and non-secret preferences are stored locally.
- English UI; Polish Source Content remains verbatim, with an English assessment summary. Business names, addresses, contacts, and quoted evidence are never translated.
- Desktop-first responsive UI supporting current Chrome, Edge, and Firefox; mobile review remains usable but is not the primary run-management target.

### Security & Privacy

- Source Content is always untrusted evidence, never an instruction, command, permission, tool argument, or authorization.
- Runtime inputs clearly delimit application instructions from Source Content and expose no broad tools.
- Structured outputs are schema-validated, size-bounded, and rejected when they request actions or contain out-of-stage fields.
- Subprocesses use direct executable spawning with no shell, fixed arguments, bounded standard input/output, timeouts, and cancellation.
- Browser networking enforces SSRF protections and disallows downloads, private networks, local services, custom protocols, and access-control bypass.
- Generic business Contact Routes are preferred. Named professional contacts are collected only when essential and publicly presented for that role; contacts are never inferred.
- Every Contact Route records its source URL and collection date.
- Public availability is never represented as marketing consent.
- Do Not Contact objections create minimal global Suppression Entries honored in future runs and exports.
- V1 performs no outreach. Before any later outreach feature, Polish/EU legal review and a separate compliance design are required.
- No external analytics, tracking, or automatic crash reporting. Logs remain local; diagnostic export is explicit and sanitized.

### Versioning and Observability

- Independently version prompts, extraction schemas, scoring rubrics, and inspection configuration.
- Record runtime name/version where exposed, all relevant application versions, source timestamps, and assessment timestamps.
- Technical logs contain events and errors but no hidden chain-of-thought, provider tokens, API keys, or unnecessary personal data.
- Effect spans and structured logs identify the Prospecting Run, task, stage, and business using application identifiers; Source Content and secrets are not logged by default.
- Show local artifact disk usage and allow explicit cleanup.

### Licensing

Release under the MIT License. Documentation must state that users are responsible for provider terms, subscription limits, source-site terms, privacy obligations, and outreach law.

## 5. Risks & Roadmap

### Phased Rollout

#### MVP — End-to-end proof

- SQLite persistence and resumable worker.
- First-run readiness and subscription-runtime configuration.
- Codex runtime adapter first, then Claude Code and OpenCode adapters behind the same contract.
- Location/category Search Brief with 5–50 target selection.
- Subscription-runtime web discovery, identity corroboration, deduplication, and eligibility exclusion.
- Playwright Quick inspection, deterministic measurements, evidence capture, structured assessment, deterministic scoring.
- Basic progress, Review Workspace, review decisions, corrections, notes, suppression, and CSV/JSON export.
- Synthetic fixtures and the initial quality gate.

#### v1.1 — Depth and calibration

- Thorough inspection mode and improved conversion-page selection.
- Stronger score explanations, filtering, diagnostics, backup/restore, cleanup, and reassessment UX.
- Calibration from the first 30–50 reviewed candidates.
- Optional public map/place, Polish directory, portal, or social discovery adapters where terms and access permit.
- Broader runtime compatibility and vision-capability handling.

#### v2.0 — Only after demonstrated need

- Optional hosted/multi-user architecture and PostgreSQL migration.
- Recurring reassessment or monitoring.
- API-backed runtime fallback through Vercel AI SDK/OpenRouter.
- Any outreach assistance only after separate product scoping and Polish/EU legal review.

### Technical Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Provider CLI changes or removes non-interactive behavior | Runs fail after provider updates | Version-aware adapters, readiness checks, contract fixtures, explicit unsupported-version state |
| Subscription limits or runtime authentication expires | Run pauses mid-assessment | Persist checkpoints, expose provider error, explicit same/alternate-runtime resume, never silently spend via API |
| Prompt injection in Source Content | Runtime attempts unauthorized behavior or produces corrupted output | Data-only trust boundary, no broad runtime tools, stdin-only content, schemas, stage validation, browser/network isolation |
| Incorrect business identity | Wrong prospect or misleading evidence | Corroborating signals, ambiguity state, precision-first threshold, User Corrections, identity fixtures |
| Subscription-runtime search coverage misses local businesses | Low yield in some locations/categories | Search exhaustion state, query audit trail, bounded query variants |
| Websites block automation or require interaction | Partial assessments | Record Inspection Block, preserve available evidence, never bypass controls, allow manual review |
| SQLite writer contention or abandoned jobs | Delayed/stuck work | One primary worker, WAL, short transactions, busy timeout, transactional claiming, startup recovery |
| Effect learning curve or inconsistent Promise/Effect boundaries | Hard-to-maintain worker code | Keep one Effect boundary per entry point, use typed services/errors consistently, and keep React presentation conventional |
| Effect v4 migration churn | Premature API rewrites | Pin stable v3, exclude v4 beta, and evaluate migration only after a stable v4 release |
| Disk growth from screenshots | Local storage pressure | Configurable artifacts, visible usage, retention policy, explicit cleanup |
| AI-generated subjective or unsupported claims | Low trust and poor outreach decisions | Observable-effect rubric, mandatory citations, schema validation, deterministic measurements and scoring |
| Public contact data creates privacy/outreach risk | Improper storage or contact | Minimize named data, preserve source/date, suppression, safe export defaults, no outreach in v1 |

### V1 Completion Gate

V1 is complete only when Oliver can authenticate a supported local runtime, execute and resume a bounded run, receive deduplicated evidence-backed candidates, review and correct every material assertion, export unsuppressed results, restart without losing completed work, and pass the versioned evaluation fixtures without Docker, cloud hosting, search API keys, or usage-based AI APIs.

### Supporting Decisions

- [Domain language](../CONTEXT.md)
- [ADR 0001 — SQLite persistence](adr/0001-sqlite-for-local-persistence.md)
- [ADR 0002 — Application-owned orchestration](adr/0002-application-owned-agent-orchestration.md)
- [ADR 0003 — Subscription-first model execution](adr/0003-subscription-first-model-execution.md)
- [ADR 0004 — Application-owned browser inspection](adr/0004-application-owned-browser-inspection.md)
- [ADR 0005 — Application-owned business discovery](adr/0005-application-owned-business-discovery.md)
- [ADR 0006 — Deterministic opportunity scoring](adr/0006-deterministic-opportunity-scoring.md)
- [ADR 0007 — Resumable bounded jobs](adr/0007-resumable-bounded-prospecting-jobs.md)
- [ADR 0008 — Untrusted Source Content](adr/0008-treat-all-source-content-as-untrusted-data.md)
- [ADR 0009 — Host-native local runtime](adr/0009-host-native-local-runtime.md)
- [ADR 0010 — Effect worker execution](adr/0010-effect-for-worker-execution.md)
- [ADR 0011 — Feature-based source and colocated unit tests](adr/0011-feature-based-source-and-colocated-unit-tests.md)
