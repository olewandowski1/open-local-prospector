/**
 * Client-safe surface of the Review Queue. The feature's main index also exports server-only work
 * (SQLite read models, task executors), so client components must import from here instead — a
 * value import from the main index would pull `better-sqlite3` and `node:child_process` into the
 * browser bundle.
 */
export { CandidateStatusBadge } from "@/features/review-queue/presentation/candidate-status-badge"
export type {
  CandidateSummary,
  RecentCandidate,
} from "@/features/review-queue/server/review-queue-read-model"
