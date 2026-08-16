CREATE TABLE `runtime_preferences` (
	`key` text PRIMARY KEY NOT NULL,
	`runtime_id` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `runtime_preferences` (`key`, `runtime_id`, `updated_at`)
SELECT 'selected', `value`, `updated_at`
FROM `local_preferences`
WHERE `key` = 'selected_runtime'
ON CONFLICT (`key`) DO NOTHING;
--> statement-breakpoint
DELETE FROM `local_preferences` WHERE `key` = 'selected_runtime';
