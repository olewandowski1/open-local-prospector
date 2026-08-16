# Use SQLite for local persistence

The single-user local application will persist prospecting runs, canonical businesses, historical assessments, evidence metadata, review decisions, and resumable job checkpoints in one SQLite database file. SQLite runs in WAL mode with foreign keys enabled, a busy timeout, and short transactions. The background worker owns job claiming and most checkpoint writes, while the web application performs comparatively infrequent review updates.

This removes Docker, ports, database credentials, and a separately managed service from local setup. It accepts SQLite's single-writer constraint because v1 has one user, one worker process, only one to four concurrent inspections, and modest write volume. Evidence files remain on the local filesystem. A future cloud, multi-user, multi-machine, or high-concurrency version may migrate persistence behind the application repository boundary to PostgreSQL.
