ALTER TABLE `contact_routes` ADD `match_key` text;--> statement-breakpoint
CREATE INDEX `contact_routes_match_key_idx` ON `contact_routes` (`match_key`);--> statement-breakpoint
ALTER TABLE `online_presences` ADD `match_key` text;--> statement-breakpoint
CREATE INDEX `online_presences_match_key_idx` ON `online_presences` (`match_key`);