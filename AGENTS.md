<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Application UI language

- Treat pages as documents: use the shared page scroller, one page header, and clearly titled sections separated by whitespace or `Separator`.
- Prefer flat sections and responsive row groups. A bordered container may group closely related rows, but do not wrap every fact or section in a separate card.
- Use `Badge` only when its compact shape materially improves scanning of a categorical state in a dense collection such as a table, list, or card grid. Do not use badges for counts, metadata, filters, action labels, or a detail page's current state.
- Present state on detail pages as a labeled row with concise semantic text. Keep ordinary facts in neutral text; reserve success, warning, info, and destructive colors for states that carry those meanings. Do not use `outline` or `secondary` as catch-all badge variants.
- Present counts as tabular text. If a count belongs to a button label, include it as ordinary text rather than nesting a badge in the button.
- Use button variants by intent: `default` for the primary forward action, `outline` for neutral secondary actions, `ghost` for low-emphasis utilities, `warning` for reversible interruption, `success` for recovery or resume, and `destructive` only for irreversible actions. Hide mutually exclusive actions that are not relevant to the current state instead of showing a cluster of disabled controls.
- In action rows, keep the title and explanatory context on the left and a normally sized action on the right; stack them on narrow viewports.
