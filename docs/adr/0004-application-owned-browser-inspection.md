# Use An Application-Owned Browser Inspection Pipeline

Status: Accepted

The application will inspect business websites with Playwright-controlled Chromium rather than relying on provider-specific browsing behavior. It will combine rendered desktop and mobile screenshots, relevant page excerpts, source URLs, and deterministic Lighthouse-style measurements; AI runtimes interpret this evidence but do not invent measurements. Authentication barriers, CAPTCHAs, automation blocks, and rate limits are recorded without bypass attempts. Evidence files live on the local filesystem while SQLite stores their metadata, preserving auditability without copying entire websites.
