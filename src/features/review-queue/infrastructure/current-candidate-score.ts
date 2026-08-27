// A business keeps every score it has ever had, so the queue reads the newest one and hides the rest.
export const CURRENT_SCORE_PER_BUSINESS = `cs.id=(select x.id from candidate_scores x where x.canonical_business_id=cs.canonical_business_id order by x.scored_at desc,x.id desc limit 1)`
