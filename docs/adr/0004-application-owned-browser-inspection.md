# Use An Application-Owned Browser Inspection Pipeline

Status: Accepted

The application will inspect business websites with Playwright-controlled Chromium rather than relying on provider-specific browsing behavior. It will combine rendered desktop and mobile screenshots, relevant page excerpts, source URLs, and deterministic Lighthouse-style measurements; AI runtimes interpret this evidence but do not invent measurements. Authentication barriers, CAPTCHAs, automation blocks, and rate limits are recorded without bypass attempts. Evidence files live on the local filesystem while SQLite stores their metadata, preserving auditability without copying entire websites.

The Website Assessment attaches the captured entry-page screenshots, desktop and mobile, to the
runtime call. Until it did, the runtime judged presentation from body text and reported a theme
credit in a footer as the defect, while a dated first screen with no visible call to action drew no
finding at all. Codex accepts them as `--image` and OpenCode as `--file`; the Claude CLI exposes no
image argument, so a Claude assessment reads text and measurements only. Image content is untrusted
evidence like any other source content, and an observation drawn from a screenshot cites the page it
shows rather than the file.
