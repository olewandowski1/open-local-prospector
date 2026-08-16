CREATE TABLE `geocoding_cache` (
	`query` text PRIMARY KEY NOT NULL,
	`results` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prospecting_defaults` (
	`key` text PRIMARY KEY NOT NULL,
	`radius_km` integer,
	`category` text NOT NULL,
	`target_count` integer NOT NULL,
	`mode` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prospecting_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`state` text NOT NULL,
	`search_brief` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prospecting_runs_request_id_unique` ON `prospecting_runs` (`request_id`);