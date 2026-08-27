export const REVIEW_STATUSES = [
  "Unreviewed",
  "Shortlisted",
  "Rejected",
  "Contacted",
  "Archived",
] as const
export const REJECTION_REASONS = [
  "NotALocalDecision",
  "NotABusinessFit",
  "EvidenceTooWeak",
  "AlreadyHasStrongWebsite",
  "Duplicate",
  "Other",
] as const
export const CORRECTION_TARGETS = [
  "IdentityLink",
  "OnlinePresence",
  "ContactRoute",
  "OpportunityClass",
  "SupportingObservation",
] as const

export const MAX_REJECTION_NOTE_LENGTH = 2_000
export const MAX_PRIVATE_NOTES_LENGTH = 10_000
export const MAX_CORRECTED_VALUE_LENGTH = 4_000
export const MAX_CORRECTION_NOTE_LENGTH = 2_000
export const MAX_SUPPRESSION_REASON_LENGTH = 500
