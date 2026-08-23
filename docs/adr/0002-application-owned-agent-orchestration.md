# Keep Orchestration And Credentials Outside Agent Runtimes

Status: Accepted

The application will own search, browsing, validation, scoring, persistence, run limits, and state transitions rather than delegating the whole workflow to a provider-specific agent. External runtimes use narrow adapters for structured reasoning tasks, retain ownership of their own authentication credentials, and are selected explicitly; failures pause with completed work preserved instead of silently switching runtimes. This keeps results auditable and consistent while allowing runtimes to change.
