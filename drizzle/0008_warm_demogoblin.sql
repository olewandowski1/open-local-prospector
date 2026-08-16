CREATE TABLE `supporting_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text NOT NULL,
	`statement` text NOT NULL,
	`source_url` text NOT NULL,
	`observed_at` integer NOT NULL,
	`evidence_state` text NOT NULL,
	`confidence` real NOT NULL,
	`sequence` integer NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `website_opportunities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `supporting_observations_opportunity_idx` ON `supporting_observations` (`opportunity_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `website_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`task_id` text NOT NULL,
	`run_business_id` text NOT NULL,
	`canonical_business_id` text NOT NULL,
	`inspection_id` text NOT NULL,
	`runtime_id` text NOT NULL,
	`runtime_version` text,
	`prompt_version` text NOT NULL,
	`output_schema_version` text NOT NULL,
	`inspection_configuration_version` text NOT NULL,
	`assessment_state` text NOT NULL,
	`summary` text NOT NULL,
	`apparent_commercial_value` real NOT NULL,
	`assessed_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `prospecting_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `run_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_business_id`) REFERENCES `run_businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`canonical_business_id`) REFERENCES `canonical_businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `website_assessments_task_idx` ON `website_assessments` (`task_id`);--> statement-breakpoint
CREATE INDEX `website_assessments_business_idx` ON `website_assessments` (`canonical_business_id`,`assessed_at`);--> statement-breakpoint
CREATE TABLE `website_opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`opportunity_class` text NOT NULL,
	`severity` integer NOT NULL,
	`confidence` real NOT NULL,
	`observable_effect` text NOT NULL,
	`explanation` text NOT NULL,
	`sequence` integer NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `website_assessments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `website_opportunities_assessment_idx` ON `website_opportunities` (`assessment_id`,`sequence`);