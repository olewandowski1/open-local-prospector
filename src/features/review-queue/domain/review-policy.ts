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
