CREATE TYPE "public"."job_status" AS ENUM('draft', 'open', 'closed', 'cancelled');--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"title" varchar(160) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(100) NOT NULL,
	"budget" numeric(12, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"delivery_days" integer NOT NULL,
	"status" "job_status" DEFAULT 'draft' NOT NULL,
	"closing_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_client_id_idx" ON "jobs" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "jobs_status_created_at_idx" ON "jobs" USING btree ("status","created_at");