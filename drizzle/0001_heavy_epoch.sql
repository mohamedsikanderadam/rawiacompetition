ALTER TABLE "campaigns" ADD COLUMN "headline" text DEFAULT 'Who runs' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "headline_accent" text DEFAULT 'the campus?' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "subline" text DEFAULT 'One tap for your university. The September tally is live.' NOT NULL;