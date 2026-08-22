// Client-safe surface: importing the feature index instead pulls `better-sqlite3` into the browser bundle.
export { REVIEW_QUEUE_THRESHOLD } from "@/features/review-queue/domain/opportunity-score"
export { CandidateStatusBadge } from "@/features/review-queue/presentation/candidate-status-badge"
export { formatScore } from "@/features/review-queue/presentation/review-presentation"
export type {
  CandidateSummary,
  RecentCandidate,
} from "@/features/review-queue/server/review-queue-read-model"
