CREATE TABLE "contestants" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contestants" ADD CONSTRAINT "contestants_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contestants_campaign_code_idx" ON "contestants" USING btree ("campaign_id","code");--> statement-breakpoint
INSERT INTO "contestants" ("campaign_id", "code", "name", "position")
SELECT "id", "university_a_code", "university_a_name", 0 FROM "campaigns"
UNION ALL
SELECT "id", "university_b_code", "university_b_name", 1 FROM "campaigns"
ON CONFLICT ("campaign_id", "code") DO NOTHING;--> statement-breakpoint
ALTER TABLE "campaigns" DROP COLUMN "university_a_code";--> statement-breakpoint
ALTER TABLE "campaigns" DROP COLUMN "university_a_name";--> statement-breakpoint
ALTER TABLE "campaigns" DROP COLUMN "university_b_code";--> statement-breakpoint
ALTER TABLE "campaigns" DROP COLUMN "university_b_name";