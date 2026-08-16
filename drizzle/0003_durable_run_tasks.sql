CREATE TABLE `run_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`business_id` text,
	`stage` text NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`lease_owner` text,
	`lease_expires_at` integer,
	`available_at` integer DEFAULT 0 NOT NULL,
	`input` text DEFAULT '{}' NOT NULL,
	`checkpoint` text,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`failure` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `prospecting_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "run_tasks_attempt_count_check" CHECK("run_tasks"."attempt_count" >= 0),
	CONSTRAINT "run_tasks_max_attempts_check" CHECK("run_tasks"."max_attempts" between 1 and 3)
);
--> statement-breakpoint
CREATE INDEX `run_tasks_claim_idx` ON `run_tasks` (`status`,`available_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `run_tasks_run_idx` ON `run_tasks` (`run_id`,`status`);--> statement-breakpoint
CREATE TABLE `run_transitions` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`task_id` text,
	`from_state` text,
	`to_state` text NOT NULL,
	`event` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `prospecting_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `run_tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `run_transitions_run_idx` ON `run_transitions` (`run_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `prospecting_runs` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `prospecting_runs` ADD `current_stage` text;--> statement-breakpoint
ALTER TABLE `prospecting_runs` ADD `completion_state` text;--> statement-breakpoint
ALTER TABLE `prospecting_runs` ADD `requested_control` text DEFAULT 'None' NOT NULL;--> statement-breakpoint
ALTER TABLE `prospecting_runs` ADD `failure` text;--> statement-breakpoint
ALTER TABLE `prospecting_runs` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `prospecting_runs` SET `updated_at` = `created_at` WHERE `updated_at` = 0;--> statement-breakpoint
CREATE TRIGGER `record_created_run_task`
AFTER INSERT ON `run_tasks`
BEGIN
	INSERT INTO `run_transitions`
		(`id`, `run_id`, `task_id`, `from_state`, `to_state`, `event`, `payload`, `schema_version`, `created_at`)
	VALUES
		(lower(hex(randomblob(16))), NEW.`run_id`, NEW.`id`, NULL, 'Pending', 'TaskCreated',
		 json_object('stage', NEW.`stage`), 1, NEW.`created_at`);
END;--> statement-breakpoint
CREATE TRIGGER `create_initial_run_task`
AFTER INSERT ON `prospecting_runs`
BEGIN
	INSERT INTO `run_tasks`
		(`id`, `run_id`, `stage`, `status`, `attempt_count`, `max_attempts`, `available_at`,
		 `input`, `schema_version`, `version`, `created_at`, `updated_at`)
	VALUES
		(lower(hex(randomblob(16))), NEW.`id`, 'RunPlanning', 'Pending', 0, 3, NEW.`created_at`,
		 json_object('searchBrief', json(NEW.`search_brief`)), 1, 1, NEW.`created_at`, NEW.`created_at`);
END;--> statement-breakpoint
INSERT INTO `run_tasks`
	(`id`, `run_id`, `stage`, `status`, `attempt_count`, `max_attempts`, `available_at`,
	 `input`, `schema_version`, `version`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(16))), `id`, 'RunPlanning', 'Pending', 0, 3, `created_at`,
	json_object('searchBrief', json(`search_brief`)), 1, 1, `created_at`, `created_at`
FROM `prospecting_runs`
WHERE NOT EXISTS (SELECT 1 FROM `run_tasks` WHERE `run_tasks`.`run_id` = `prospecting_runs`.`id`);
