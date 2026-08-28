# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Reassess a Candidate Business from its review panel. The run repeats the discovery record behind
  the score, verifies contact routes, inspects the website again, then assesses and scores it,
  writing new records and keeping the earlier findings. It repeats the market and runtime of the run
  that found the business instead of searching again, so no discovery call is spent. A business can
  be reassessed repeatedly, but not twice at once.
- Add `pnpm inspect:check`, which captures a fixture site through the real inspection pipeline
  under the worker loader so a transpiler helper leaking into the page fails the build.

### Changed

- Anchor the severity bands so an assessment uses the range instead of rating almost everything 3.
  A captured first screen with no visible telephone, enquiry or booking action is severity 4,
  because the visitor arrived and cannot act; an accessibility or layout defect on a page a visitor
  can still complete is 3 at most however many instances it has. A garage whose first screen offered
  no way to act had been scoring below one with a visible telephone, navigation and hero action, and
  now scores above it, 76.8 against 68.8.
- Raise at most one Website Opportunity per class. One business had reported unlabelled controls,
  missing alternative text and horizontal overflow as three separate accessibility entries.
- Stop scoring first contentful paint. One home page measured 296 ms and 3,448 ms across runs, so a
  business moved up to 2 points on network conditions rather than on its website. Paint time is
  still recorded, shown to the reader and given to the runtime. Rescoring the same business twice
  now moves the total by at most 1.3 points with severity identical, against swings of 34, 12 and 23
  points before the runtime could see the pages.
- Show the Website Assessment the pages it is judging. The captured desktop and mobile screenshots
  are now attached to the runtime call, so presentation is assessed from what a visitor sees rather
  than from body text. Auto Tytan Rumia had drawn no finding at all from text, and with the
  screenshot the runtime reported a visually dated first screen dominated by a photograph with no
  visible contact or booking action. Codex and OpenCode accept image attachments; a Claude
  assessment still reads text and measurements only.
- Rebalance the Opportunity Score to severity 55% and measured defects 10%, and read the worst
  captured page rather than the mean. At 25% the measured component rejected a site that measured
  clean but gave a visitor no reason to act, and averaging hid a home page that took 3.4 seconds to
  paint behind three fast pages.
- Score the defects measured on a candidate website instead of how confident the runtime was that
  it saw them. Evidence confidence sat at 24 to 25 of 25 for every candidate with captured pages,
  so a quarter of the score carried no information, while the runtime placed six of eight observed
  candidates in one severity band and left them within a single point of each other. The 25 points
  now come from the recorded per-page measurements, which spread those six across 7.6 points and
  order them by what was measured. Two sites with no measured defect left Candidates.
- Require a Website Assessment to account for every deterministic measurement it was given: a
  measured accessibility, overflow or HTTPS defect is now classified or explicitly dismissed in the
  summary rather than silently ignored. Five unlabelled controls were previously left unmentioned on
  one business while nine scored severity 3 on another, which decided whether a Candidate Business
  qualified. The technology a page is built with no longer counts as an opportunity, so a theme or
  framework credit cannot be raised against a business.
- Limit fully blocked website inspections to severity 4 of 5 and confidence 0.6, retain them as
  reviewable Candidate Businesses, and present their opportunity as Limited Website Evidence.
- Rename repository, package, workspace, backup, and export identifiers to Open Prospector.
- Present Overview as a fixed list of the 10 most recent Candidate Businesses with a direct link to
  the complete Review Workspace.
- Load filtered candidate exports, evidence, and contacts in three bounded database queries instead
  of querying related records once per candidate.
- Split the New Run sheet into focused bootstrap, form, field, runtime, and preflight components.
- Enforce the repository rule that source comments remain concise, single-line rationale.

### Security

- Apply one runtime environment allowlist to probes and task execution, preserving custom Codex
  homes while excluding inherited provider credentials.
- Reject over-limit Suppression Entry reasons consistently at the route and persistence boundaries.
- Document private vulnerability reporting and enable it for the repository.

### Fixed

- Read a finished reassessment as Reassessed rather than Exhausted. A reassessment names the
  business it observes, so it has no target left to exhaust, and one that correctly disqualified a
  business had been settling as a failed search.
- Give the verification gate a timeout the Windows CI runner can meet. Suites that migrate real
  SQLite files and copy artifacts finish in well under a second locally but twice exceeded vitest’s
  five second default on a contended runner, failing `pnpm check` on work that had not touched them.
- Capture a screenshot that depicts the page rather than the preloader covering it. A full-screen
  overlay outlived the network settling, so the image was blank while the same page had already
  yielded its text. The capture is now retried, bounded, until the image can depict that text: one
  garage home page went from 6 KB of flat colour to 728 KB showing its telephone number,
  navigation and enquiry action. Withholding such an image remains the fallback when it never
  resolves.
- Withhold a screenshot too small to depict the text its page contains. A working garage site
  screenshotted its home page as a flat preloader that the capture froze in place, and the runtime
  read the image and reported the site broken at severity 5 and confidence 0.99, sending it to the
  top of Candidates at 90.8. The same page had recorded 3,965 characters of services, telephone,
  email and address. Such an image is a capture artifact rather than evidence of appearance, so the
  assessment now falls back to text and measurements and the business scores 67.2 on its real
  accessibility and resource defects.
- Show one Candidate Business per row in Candidates, Overview and exports, reading its current
  score instead of one row for every score it has ever had. The workspace listed 183 rows for 120
  businesses, one of them five times. A re-scored business now replaces its earlier entry, and its
  written notes and follow-up date carry onto the new score while the decision resets so the
  reader judges it again.
- Inspect a one-page website as one page rather than recording a navigation failure: a contact
  fragment addresses the page already captured, so it is no longer followed as a second page.
- Capture website evidence instead of blocking every HTTPS inspection: name Basic in the proxy
  tunnel challenge that Chromium requires, stop a tunnel reset from crashing the worker, and
  define the transpiler name helper inside the inspected page. Inspection Blocks now carry the
  underlying navigation failure rather than one fixed sentence.
- Invoke each provider's actual fixed update command and terminate the complete updater process
  tree when a readiness or update command exceeds its bounds.
- Enforce the loopback Host boundary before dynamic pages, React Server Component requests, Server
  Actions, and API routes instead of protecting API routes alone.
- Neutralize source-derived spreadsheet formulas in CSV exports, restore unfiltered exports of
  every candidate, prevent export responses from being cached or content-sniffed, and exercise
  review, correction, and export round trips in the isolated workspace suite.
- Reject unknown review reasons and over-limit notes or corrections instead of persisting invalid
  categorical state or silently truncating reader-authored text.
- Key eligible businesses without a telephone or dedicated website on a verified contact route,
  preventing same-name neighbours from sharing candidate and suppression state.
- Keep the Overview candidate table within its content pane when all desktop columns are visible.
- Verify the isolated destructive browser-test workspace with platform-native path semantics on
  Windows and Linux.
- Run dependency setup and browser caching with Node 24 based GitHub Actions.
- Wait for runtime readiness to settle before the browser suite decides whether steering is
  available, preventing a loading skeleton from being mistaken for an authenticated runtime.
- Disclose when the run list, review queue, or recent-candidate overview holds back rows instead of
  presenting bounded results as complete, and keep overview metrics complete beyond those bounds.
- Surface candidate overview database failures instead of replacing them with misleading empty
  metrics and lists, and preserve that behavior for saved Search Brief and runtime preferences.
- Keep same-name businesses in one locality separate when their corroborated identity fingerprints
  differ, preventing evidence and review state from being attached to the wrong business.
- Preserve newly created workspace-operation locks while their owner initializes them, and only let
  a lease remove the lock file it owns.
- Route browser inspection through an authenticated loopback proxy that validates DNS and connects
  to the approved numeric address, preventing DNS rebinding between validation and connection.
- Show captured website screenshots and readable deterministic measurements in candidate details
  without exposing local artifact paths, and warn that workspace backups are unencrypted and can
  contain personal data.
- Run the verification gate on Linux and Windows in CI, include synthetic application and isolated
  workspace browser suites on Linux, and require opt-in live runs to finish successfully rather
  than accepting cancellation or infrastructure failure.
- Validate exact backup metadata and non-secret configuration, bound archive entry counts and
  metadata sizes, preserve unexpected setup error details, and replace the vulnerable development
  esbuild transitive dependency with a patched version.
- OpenCode discovery now receives only public search tools, while structuring and assessment run
  with every tool denied and external plugins disabled.
- Tasks abandoned by repeated worker exits now exhaust their attempt budget and settle visibly
  instead of being reclaimed forever.
- Runtime timeouts, output bounds, and interruptions now terminate the complete per-task process
  tree instead of leaving provider descendants running.
- Final-task settlement now gives cancellation precedence, completes taskless late pauses, and
  repairs previously stranded taskless paused runs on resume.
- Lifting a Suppression Entry now restores evidence-backed candidate eligibility, including scores
  cleared by earlier versions.
- Candidate detail infrastructure failures now remain server errors instead of being misreported
  as missing candidates.
- Worker restarts now preserve the web process's clickable loopback URL in the combined development
  terminal.
- Candidate detail loading now stops on bounded request failures, offers an explicit retry, and
  previews the actual evidence, administration, and danger-zone layout while data is loading.
- API traffic now accepts the local app through either `127.0.0.1` or `localhost`, while
  state-changing routes reject foreign browser origins.
- Deleting a business now removes its task checkpoints, failures, and business-scoped Technical Run
  Log entries while retaining unrelated run history.
- Explicitly resuming with another runtime now updates unfinished discovery task input and removes
  configuration belonging to the previous provider.
- Supporting Observation timestamps must now exactly match the cited evidence supplied to the
  assessment runtime.
- The MVP quality gate now replays versioned synthetic discovery and assessment fixtures through
  production verification, identity, citation, scoring, and qualification rules without network
  access.
- A deterministic offline integration suite now exercises the assembled worker pipeline, durable
  payload handoffs, restart idempotency, and isolated per-business failure behavior.
- Page scrolling now responds across the full content region while content remains centered and
  width limited.

## [0.0.1] - 2026-08-23

### Added

- Location and category based discovery for independent businesses.
- Public website inspection with source URLs, observation times, and deterministic candidate scoring.
- Durable, resumable execution through a local worker and SQLite workspace.
- Claude, Codex, and OpenCode runtime support through clients installed and authenticated locally.
- Candidate review, correction, suppression, and export workflows.

[Unreleased]: https://github.com/olewandowski1/open-prospector/compare/961156c...HEAD
[0.0.1]: https://github.com/olewandowski1/open-prospector/tree/961156c
