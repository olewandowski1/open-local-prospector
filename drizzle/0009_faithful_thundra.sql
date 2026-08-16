CREATE TABLE `candidate_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`task_id` text NOT NULL,
	`run_business_id` text NOT NULL,
	`canonical_business_id` text NOT NULL,
	`assessment_id` text NOT NULL,
	`rubric_version` text NOT NULL,
	`severity_component` real NOT NULL,
	`confidence_component` real NOT NULL,
	`contact_component` real NOT NULL,
	`local_decision_component` real NOT NULL,
	`commercial_value_component` real NOT NULL,
	`total` real NOT NULL,
	`qualified` integer NOT NULL,
	`scored_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `prospecting_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `run_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_business_id`) REFERENCES `run_businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`canonical_business_id`) REFERENCES `canonical_businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `candidate_scores_task_idx` ON `candidate_scores` (`task_id`);--> statement-breakpoint
CREATE INDEX `candidate_scores_rank_idx` ON `candidate_scores` (`qualified`,`total`,`scored_at`);