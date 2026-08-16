CREATE TABLE `discovered_businesses` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`source` text NOT NULL,
	`source_identifier` text NOT NULL,
	`discovery_key` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`result_url` text NOT NULL,
	`description` text,
	`raw_attributes` text NOT NULL,
	`discovered_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `prospecting_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discovered_businesses_run_key_idx` ON `discovered_businesses` (`run_id`,`discovery_key`);--> statement-breakpoint
CREATE INDEX `discovered_businesses_run_idx` ON `discovered_businesses` (`run_id`,`discovered_at`);--> statement-breakpoint
CREATE TABLE `discovery_occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`query_id` text NOT NULL,
	`business_id` text NOT NULL,
	`source_identifier` text NOT NULL,
	`result_url` text NOT NULL,
	`duplicate_input` integer NOT NULL,
	`raw_attributes` text NOT NULL,
	`discovered_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `prospecting_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`query_id`) REFERENCES `discovery_queries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `discovered_businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `discovery_occurrences_run_idx` ON `discovery_occurrences` (`run_id`,`discovered_at`);--> statement-breakpoint
CREATE TABLE `discovery_queries` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`task_id` text,
	`source` text NOT NULL,
	`query_text` text NOT NULL,
	`page_offset` integer NOT NULL,
	`result_count` integer NOT NULL,
	`unique_count` integer NOT NULL,
	`duplicate_count` integer NOT NULL,
	`more_results` integer NOT NULL,
	`completed_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `prospecting_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `run_tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discovery_queries_run_query_page_idx` ON `discovery_queries` (`run_id`,`query_text`,`page_offset`);--> statement-breakpoint
CREATE INDEX `discovery_queries_run_idx` ON `discovery_queries` (`run_id`,`completed_at`);