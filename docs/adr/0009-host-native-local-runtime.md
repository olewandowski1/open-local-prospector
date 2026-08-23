# Run The Local Application And Provider Clients On The Host

Status: Accepted

The v1 application runs as a host-native Next.js web process and a host-native background worker started by one project command. This lets small runtime adapters invoke installed Codex, Claude, and OpenCode clients without mounting credential directories or bridging host executables into containers. Provider login remains an explicit terminal action outside the application.

SQLite replaces a database service, Playwright installs a dedicated host-local Chromium, and evidence artifacts live in an ignored configurable directory. Local setup therefore requires Node.js, pnpm, Playwright Chromium, and at least one authenticated provider CLI, but not Docker or a search API key. The v1 UI opens in the user's normal browser; desktop packaging and system-service installation are deferred.
