CREATE TABLE `candidate_corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`score_id` text NOT NULL,
	`target` text NOT NULL,
	`corrected_value` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`score_id`) REFERENCES `candidate_scores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `candidate_corrections_history_idx` ON `candidate_corrections` (`score_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `candidate_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`score_id` text NOT NULL,
	`status` text DEFAULT 'Unreviewed' NOT NULL,
	`rejection_reason` text,
	`rejection_note` text,
	`private_notes` text DEFAULT '' NOT NULL,
	`follow_up_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`score_id`) REFERENCES `candidate_scores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `candidate_reviews_score_id_unique` ON `candidate_reviews` (`score_id`);