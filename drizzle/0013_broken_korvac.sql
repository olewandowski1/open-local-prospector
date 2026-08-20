PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_suppression_entries` (
	`identity_fingerprint` text PRIMARY KEY NOT NULL,
	`canonical_business_id` text,
	`business_name` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_suppression_entries`("identity_fingerprint", "canonical_business_id", "business_name", "reason", "created_at")
SELECT cb."identity_fingerprint", se."canonical_business_id", cb."name", se."reason", se."created_at"
FROM `suppression_entries` se
JOIN `canonical_businesses` cb ON cb."id" = se."canonical_business_id";--> statement-breakpoint
DROP TABLE `suppression_entries`;--> statement-breakpoint
ALTER TABLE `__new_suppression_entries` RENAME TO `suppression_entries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
