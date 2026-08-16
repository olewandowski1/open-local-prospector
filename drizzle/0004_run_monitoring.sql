CREATE TABLE `run_metrics` (
	`run_id` text PRIMARY KEY NOT NULL,
	`queries` integer DEFAULT 0 NOT NULL,
	`discoveries` integer DEFAULT 0 NOT NULL,
	`duplicates` integer DEFAULT 0 NOT NULL,
	`exclusions` integer DEFAULT 0 NOT NULL,
	`websites` integer DEFAULT 0 NOT NULL,
	`assessments` integer DEFAULT 0 NOT NULL,
	`qualified_candidates` integer DEFAULT 0 NOT NULL,
	`blocked_inspections` integer DEFAULT 0 NOT NULL,
	`target_remaining` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `prospecting_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `technical_run_events` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`task_id` text,
	`business_id` text,
	`kind` text NOT NULL,
	`source_identifier` text,
	`result_url` text,
	`message` text NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `prospecting_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `run_tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `technical_run_events_run_idx` ON `technical_run_events` (`run_id`,`created_at`);--> statement-breakpoint
CREATE TRIGGER `create_initial_run_metrics`
AFTER INSERT ON `prospecting_runs`
BEGIN
	INSERT INTO `run_metrics`
		(`run_id`, `target_remaining`, `version`, `updated_at`)
	VALUES
		(NEW.`id`, json_extract(NEW.`search_brief`, '$.targetCount'), 1, NEW.`created_at`);
END;--> statement-breakpoint
INSERT INTO `run_metrics` (`run_id`, `target_remaining`, `version`, `updated_at`)
SELECT `id`, json_extract(`search_brief`, '$.targetCount'), 1, `created_at`
FROM `prospecting_runs`
WHERE NOT EXISTS (SELECT 1 FROM `run_metrics` WHERE `run_metrics`.`run_id` = `prospecting_runs`.`id`);
