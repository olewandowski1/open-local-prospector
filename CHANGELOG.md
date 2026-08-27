# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

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

[Unreleased]: https://github.com/olewandowski1/open-local-prospector/compare/961156c...HEAD
[0.0.1]: https://github.com/olewandowski1/open-local-prospector/tree/961156c
