CREATE TABLE `inspection_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`inspection_id` text NOT NULL,
	`page_id` text NOT NULL,
	`kind` text NOT NULL,
	`viewport` text NOT NULL,
	`path` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`inspection_id`) REFERENCES `website_inspections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `inspection_pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inspection_artifacts_inspection_idx` ON `inspection_artifacts` (`inspection_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `inspection_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`inspection_id` text NOT NULL,
	`code` text NOT NULL,
	`url` text,
	`message` text NOT NULL,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`inspection_id`) REFERENCES `website_inspections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inspection_blocks_inspection_idx` ON `inspection_blocks` (`inspection_id`,`recorded_at`);--> statement-breakpoint
CREATE TABLE `inspection_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`inspection_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`viewport` text NOT NULL,
	`requested_url` text NOT NULL,
	`final_url` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`language` text,
	`rendered_text` text NOT NULL,
	`links` text NOT NULL,
	`forms` text NOT NULL,
	`console_failures` text NOT NULL,
	`network_failures` text NOT NULL,
	`measurements` text NOT NULL,
	`captured_at` integer NOT NULL,
	FOREIGN KEY (`inspection_id`) REFERENCES `website_inspections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inspection_pages_inspection_idx` ON `inspection_pages` (`inspection_id`,`viewport`,`sequence`);--> statement-breakpoint
CREATE TABLE `website_inspections` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`task_id` text NOT NULL,
	`run_business_id` text NOT NULL,
	`canonical_business_id` text NOT NULL,
	`status` text NOT NULL,
	`configuration_version` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `prospecting_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `run_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_business_id`) REFERENCES `run_businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`canonical_business_id`) REFERENCES `canonical_businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `website_inspections_task_idx` ON `website_inspections` (`task_id`);--> statement-breakpoint
CREATE INDEX `website_inspections_business_idx` ON `website_inspections` (`canonical_business_id`,`completed_at`);