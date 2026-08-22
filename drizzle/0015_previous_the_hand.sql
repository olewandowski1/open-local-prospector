CREATE TABLE `discovery_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`task_id` text,
	`query_text` text NOT NULL,
	`report_text` text NOT NULL,
	`report_prompt_version` text NOT NULL,
	`structure_prompt_version` text NOT NULL,
	`structure_schema_version` text NOT NULL,
	`runtime_id` text NOT NULL,
	`runtime_model` text,
	`businesses_returned` integer NOT NULL,
	`businesses_verified` integer NOT NULL,
	`rejections` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `prospecting_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `run_tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `discovery_reports_run_idx` ON `discovery_reports` (`run_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `discovered_businesses` ADD `structured` text;