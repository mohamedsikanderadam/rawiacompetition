CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_user_id" integer,
	"admin_email" text NOT NULL,
	"action" text NOT NULL,
	"vote_id" integer,
	"reason" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"university_a_code" text NOT NULL,
	"university_a_name" text NOT NULL,
	"university_b_code" text NOT NULL,
	"university_b_name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"reopened" boolean DEFAULT false NOT NULL,
	"show_scores_on_vote" boolean DEFAULT true NOT NULL,
	"show_confirmation_score" boolean DEFAULT true NOT NULL,
	"confirmation_duration_ms" integer DEFAULT 2500 NOT NULL,
	"attract_enabled" boolean DEFAULT true NOT NULL,
	"attract_timeout_ms" integer DEFAULT 45000 NOT NULL,
	"mode" text DEFAULT 'demo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_name" text NOT NULL,
	"device_identifier" text NOT NULL,
	"token_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_device_identifier_unique" UNIQUE("device_identifier"),
	CONSTRAINT "devices_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"university" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"device_id" integer NOT NULL,
	"session_id" text NOT NULL,
	"client_vote_id" text NOT NULL,
	"status" text DEFAULT 'valid' NOT NULL,
	"invalidated_at" timestamp with time zone,
	"invalidated_by" integer,
	"invalid_reason" text
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_invalidated_by_admin_users_id_fk" FOREIGN KEY ("invalidated_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "votes_client_vote_id_idx" ON "votes" USING btree ("client_vote_id");--> statement-breakpoint
CREATE INDEX "votes_campaign_status_created_idx" ON "votes" USING btree ("campaign_id","status","created_at");--> statement-breakpoint
CREATE INDEX "votes_device_created_idx" ON "votes" USING btree ("device_id","created_at");