CREATE TABLE `canonical_businesses` (
	`id` text PRIMARY KEY NOT NULL,
	`identity_fingerprint` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`locality` text NOT NULL,
	`country_code` text NOT NULL,
	`decision_scope` text NOT NULL,
	`last_assessed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `canonical_businesses_fingerprint_idx` ON `canonical_businesses` (`identity_fingerprint`);--> statement-breakpoint
CREATE TABLE `contact_routes` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_business_id` text NOT NULL,
	`run_business_id` text NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`source_url` text NOT NULL,
	`collected_at` integer NOT NULL,
	FOREIGN KEY (`canonical_business_id`) REFERENCES `canonical_businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_business_id`) REFERENCES `run_businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contact_routes_run_value_idx` ON `contact_routes` (`run_business_id`,`type`,`value`);--> statement-breakpoint
CREATE TABLE `identity_evidence_queries` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`task_id` text,
	`discovered_business_id` text NOT NULL,
	`source` text NOT NULL,
	`query_text` text NOT NULL,
	`result_count` integer NOT NULL,
	`completed_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `prospecting_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `run_tasks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`discovered_business_id`) REFERENCES `discovered_businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `identity_evidence_query_idx` ON `identity_evidence_queries` (`run_id`,`discovered_business_id`,`query_text`);--> statement-breakpoint
CREATE TABLE `identity_evidence_results` (
	`id` text PRIMARY KEY NOT NULL,
	`query_id` text NOT NULL,
	`run_id` text NOT NULL,
	`discovered_business_id` text NOT NULL,
	`source_identifier` text NOT NULL,
	`title` text NOT NULL,
	`result_url` text NOT NULL,
	`description` text,
	`collected_at` integer NOT NULL,
	FOREIGN KEY (`query_id`) REFERENCES `identity_evidence_queries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `prospecting_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`discovered_business_id`) REFERENCES `discovered_businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `identity_evidence_results_business_idx` ON `identity_evidence_results` (`discovered_business_id`,`collected_at`);--> statement-breakpoint
CREATE TABLE `online_presences` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_business_id` text,
	`run_business_id` text NOT NULL,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`source_identifier` text NOT NULL,
	`association_state` text NOT NULL,
	`collected_at` integer NOT NULL,
	FOREIGN KEY (`canonical_business_id`) REFERENCES `canonical_businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_business_id`) REFERENCES `run_businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `online_presences_run_url_idx` ON `online_presences` (`run_business_id`,`url`);--> statement-breakpoint
CREATE TABLE `run_businesses` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`discovered_business_id` text NOT NULL,
	`canonical_business_id` text,
	`status` text NOT NULL,
	`identity_confidence` text NOT NULL,
	`exclusion_code` text,
	`exclusion_reason` text,
	`signals` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `prospecting_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`discovered_business_id`) REFERENCES `discovered_businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`canonical_business_id`) REFERENCES `canonical_businesses`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `run_businesses_discovery_idx` ON `run_businesses` (`run_id`,`discovered_business_id`);--> statement-breakpoint
CREATE INDEX `run_businesses_run_status_idx` ON `run_businesses` (`run_id`,`status`);