CREATE TABLE `suppression_entries` (
	`canonical_business_id` text PRIMARY KEY NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`canonical_business_id`) REFERENCES `canonical_businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
