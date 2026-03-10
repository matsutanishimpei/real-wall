-- Migration: Add category column to base_prompts
ALTER TABLE `base_prompts` ADD COLUMN `category` text DEFAULT 'general' NOT NULL;
