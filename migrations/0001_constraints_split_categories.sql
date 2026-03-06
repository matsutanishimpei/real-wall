CREATE TABLE `constraints` (
	`id` text PRIMARY KEY NOT NULL,
	`main_category` text NOT NULL,
	`sub_category` text NOT NULL,
	`detail_category` text NOT NULL,
	`description` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
DROP TABLE IF EXISTS `slot_constraints`;

