ALTER TABLE "admin_users" ADD COLUMN "username" text;--> statement-breakpoint
UPDATE "admin_users" SET "username" = lower(split_part("email", '@', 1)) WHERE "username" IS NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_username_unique" UNIQUE("username");
