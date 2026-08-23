# Domain Language

This context describes a prospecting system that helps Oliver find businesses whose public online presence suggests an opportunity for website creation or improvement. Poland is the initial market focus, but searches are not geographically restricted.

## Core Terms

**Discovered Business**:
A business returned by a configured Public Source before eligibility and opportunity qualification. A Discovered Business may be excluded without becoming a Candidate Business, with the reason retained to avoid unnecessary repeated assessment.
_Avoid_: Search result, raw lead

**Candidate Business**:
A business discovered from publicly accessible web sources whose Online Presence contains evidence of a Website Opportunity. Candidate Businesses are independent local businesses or small regional companies where website decisions are likely to be made locally; centrally controlled chains, franchises, and online-only businesses are excluded. A Candidate Business has one canonical identity even when it appears in multiple Prospecting Runs.
_Avoid_: Lead, target, customer

**Search Brief**:
The user-selected location, business category, and target of 5 to 50 Candidate Businesses that guide a prospecting search. A category may come from the system's predefined choices or be entered by the user.
_Avoid_: Search query, prompt, filters

**Prospecting Run**:
One bounded execution of a Search Brief using a single primary category and selected AI runtime. It uses one or more configured Public Sources until it reaches the requested number of Candidate Businesses or repeated searches stop producing unique eligible businesses. Recently assessed businesses are skipped by default; explicitly including or reassessing them never overwrites assessment history.
_Avoid_: Crawl, scrape job, search session

**Run Mode**:
The chosen exploration depth of a Prospecting Run. Quick mode minimizes sources and inspected pages while preserving the evidence standard; Thorough mode explores additional sources and pages.
_Avoid_: Quality level, AI mode

**Search Area**:
The geographic interpretation of a user-entered city or municipality and optional radius. Ambiguous locations require confirmation against geocoded alternatives, and the interpreted area is displayed before a Prospecting Run begins. Locations outside Poland remain valid.
_Avoid_: Location string, geo filter

**Run Preflight**:
The readiness check performed before a Prospecting Run starts. It verifies the local SQLite database and schema, the selected discovery source, Playwright, the selected AI runtime's exposed authentication status, disk availability, and configuration. It estimates workload and likely duration without presenting subscription usage as a precise monetary cost.
_Avoid_: Health check, validation screen

**Run Progress**:
Application-generated progress derived from persisted stages and counts: queries completed, businesses discovered, duplicates and exclusions, websites found, assessments completed, qualified candidates, partial or blocked inspections, and target remaining. It may expose source and tool events but never hidden chain-of-thought.
_Avoid_: Agent thoughts, live reasoning

**Run Completion State**:
The explicit outcome of a Prospecting Run: Target Reached, Search Exhausted, Cancelled with Partial Results, Paused, Runtime Unavailable, Completed with Warnings, or Infrastructure Failed. Individual business failures are isolated and cannot alone produce Infrastructure Failed.
_Avoid_: Success flag, job status

**Technical Run Log**:
The diagnostic history of generated search queries, discovery sources, timestamps, result URLs, stage transitions, retries, and failure or exclusion reasons. It supports reproducibility and debugging but is kept outside the normal Review Workspace.
_Avoid_: Chain of thought, agent transcript

**Business Identity**:
The corroborated association between a discovered business and its website or social profile, established through matching signals such as name, location, address, phone number, or reciprocal links. An ambiguous association is flagged for review and is not treated as confirmed.
_Avoid_: Website owner, account match

**Online Presence**:
The publicly accessible web footprint of a Candidate Business, including its website, social-media profiles, and business-directory listings.
_Avoid_: Digital presence, online profile

**Website Opportunity**:
Evidence in a Candidate Business's Online Presence suggesting that a new or improved website could strengthen its presentation, usability, performance, search visibility, or ability to generate enquiries or sales.
_Avoid_: Bad website, unqualified lead

Website Opportunities are classified as:

- no dedicated website
- broken or effectively unusable website
- outdated or unprofessional presentation
- poor mobile usability, accessibility, or performance
- weak local search visibility and discoverability
- missing or confusing enquiry, booking, or purchasing journey

**Supporting Observation**:
A verifiable fact from a Public Source that supports a Website Opportunity. Every Website Opportunity must cite one or more Supporting Observations rather than relying on an unsupported qualitative label.
_Avoid_: AI opinion, assumption, proof

**Website Assessment**:
An inspection of a Candidate Business's actual website, covering at least its homepage and primary enquiry, booking, service, or purchasing journey. It combines rendered desktop and mobile evidence, deterministic technical measurements, and AI interpretation when supported by the selected runtime. Search-result snippets and metadata may support discovery but cannot substitute for visiting the site. Assessments are timestamped and retained so later reassessments do not erase earlier findings.
_Avoid_: Website review, audit

**Inspection Block**:
A website condition that prevents a compliant Website Assessment, such as required authentication, a CAPTCHA, an automation block, or an access limit. The reason is recorded and the system does not attempt to bypass it.
_Avoid_: Failed website, inaccessible business

**Contact Route**:
A publicly listed means of contacting a Candidate Business, classified as a generic business email, named professional email, business telephone, contact form, social-messaging channel, or other route. Generic business routes are preferred. A Candidate Business must have at least one Contact Route to enter the Review Queue; named personal details are collected only when essential, publicly presented in a professional role, and never inferred or generated. Every Contact Route retains its source URL and collection date.
_Avoid_: Contact details, scraped contact

**Suppression Entry**:
The minimum record needed to ensure that a business or person marked Do Not Contact is not recommended again, reassessed for outreach, or included in an export. Suppression applies across all Prospecting Runs and is retained only as long as necessary to enforce the request.
_Avoid_: Blocklist, deleted lead

**Local Privacy Boundary**:
The v1 application stores prospecting data locally and minimizes personal data rather than attempting to implement a complete outreach-compliance platform. It supports deletion and Suppression Entries, prefers company and generic business information, and keeps outreach outside the application. Consent workflows, privacy-notice generation, and named-person enrichment are deferred until an outreach or collaborative/cloud feature requires them.
_Avoid_: GDPR mode, compliance dashboard

**Opportunity Score**:
An explainable score from 0 to 100 calculated by application code from structured assessment fields: Website Opportunity severity (40%), confidence in the Supporting Observations (25%), Contact Route availability (15%), likelihood of local decision-making (10%), and the apparent value a better website could create (10%). A score of at least 60 initially qualifies a Candidate Business for the Review Queue. No single opportunity class, including having no website, automatically determines rank, and every score retains the rubric version used.
_Avoid_: AI score, lead score

**Review Example**:
A reviewed Candidate Business paired with Oliver's Review Status and reason. Review Examples form an evaluation set for explicitly proposed rubric improvements; they never alter prompts or weights automatically.
_Avoid_: Training data, feedback signal

**Shortlist Yield**:
The proportion of reviewed Candidate Businesses that Oliver marks Shortlisted. It is the primary product-success measure because useful prospects matter more than raw discovery volume. An initial 30% target is provisional and recalibrated from real Review Examples rather than presented as a product claim.
_Avoid_: Conversion rate, lead quality

**Identity Precision**:
The proportion of confirmed Business Identities whose associated website and profiles belong to the intended business. The system prioritizes Identity Precision over discovery recall: omitting an uncertain business is preferable to presenting a false association. The initial evaluation target is at least 90% correct business-to-website associations.
_Avoid_: Match score, discovery accuracy

**Evaluation Fixture**:
A versioned, deterministic synthetic or safely captured test case representing a normal or difficult assessment, such as a Polish-language site, ambiguous identity, no-site business, inaccessible site, good existing site, or false-positive opportunity. Evaluation Fixtures contain no shipped real-person contact data and are rerun when prompts, extraction, or scoring changes.
_Avoid_: Seed lead, production example

**Review Queue**:
A ranked collection of Candidate Businesses and their Supporting Observations for Oliver to assess before any outreach occurs. Inclusion does not authorize or initiate contact.
_Avoid_: Outreach list, mailing list

**Review Status**:
Oliver's disposition of a Candidate Business: Unreviewed, Shortlisted, Rejected, Contacted, or Archived. Rejection includes a reason so the business is not repeatedly recommended without new evidence.
_Avoid_: Pipeline stage, lead status

**Review Workspace**:
The two-pane interface where Oliver reviews a ranked candidate list without losing filters while inspecting one Candidate Business in detail. Candidate summaries show identity, location, Opportunity Score, leading Website Opportunity, contact and website availability, confidence, inspection state, Review Status, and the strongest Supporting Observations. Detail views expose the score breakdown, evidence, desktop and mobile captures, deterministic measurements, Online Presence, Contact Routes, source history, and inspection limitations.
_Avoid_: Dashboard, lead table

**User Correction**:
An explicit correction by Oliver to a Business Identity, Online Presence link, Contact Route, Website Opportunity, or Supporting Observation. A User Correction affects the current canonical record while the original machine-produced assessment remains available in assessment history.
_Avoid_: Override, edited AI output

**Evidence State**:
The presentation category that distinguishes a confirmed fact, AI assessment, ambiguous identity association, missing evidence, or Inspection Block. Confidence is displayed as uncertainty and never presented as certainty.
_Avoid_: Confidence badge, truth status

**Review Note**:
A private free-text note and optional follow-up date attached to a Candidate Business. Review Notes support Oliver's personal workflow but do not form a CRM pipeline, initiate outreach, or cause Review Status to be inferred.
_Avoid_: Activity, task

**Public Source**:
A web page that can be accessed without a paid data subscription or authentication to a private account.
_Avoid_: Public data

**Source Content**:
Text, markup, media, metadata, or other material obtained from a Public Source. Source Content is always untrusted evidence and never an instruction, command, permission, tool argument, or authorization, regardless of how it is phrased.
_Avoid_: Page instructions, agent context

**Local Application**:
The single-user v1 product served on the host and bound to `127.0.0.1` by default. It consists of a web process and background worker started through one project command, uses a local SQLite file and filesystem artifacts, and has no application account, remote access, external telemetry, or automatic crash reporting.
_Avoid_: Desktop app, hosted service

**Application Backup**:
An explicitly created package containing the SQLite database, assessment artifacts, and non-secret configuration. It never contains discovery or API keys, provider credentials, provider authentication caches, or tokens and can be validated before restoration.
_Avoid_: Database dump, sync
