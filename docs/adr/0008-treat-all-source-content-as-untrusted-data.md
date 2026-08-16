# Treat all source content as untrusted data

All website, directory, search-result, and social-profile content is data only and can never supply instructions, permissions, tool arguments, or authority to an AI runtime. The application delimits source material from system instructions, gives runtimes narrowly scoped stage-specific inputs and tools, validates structured outputs, and rejects attempted actions outside the active assessment stage.

Browser inspection also blocks localhost, private-network destinations, file and custom protocols, downloads, pop-ups, and unexpected navigation. Authentication barriers, CAPTCHAs, access controls, and rate limits are recorded rather than bypassed. These controls apply identically to every subscription runtime and API fallback.
