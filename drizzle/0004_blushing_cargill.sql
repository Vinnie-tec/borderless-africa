CREATE TYPE "public"."proposal_status" AS ENUM('pending', 'negotiating', 'accepted', 'rejected', 'withdrawn', 'expired');--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"freelancer_id" text NOT NULL,
	"cover_letter" text NOT NULL,
	"proposed_price" numeric(12, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"delivery_days" integer NOT NULL,
	"status" "proposal_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_freelancer_id_user_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proposals_job_id_idx" ON "proposals" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "proposals_freelancer_id_idx" ON "proposals" USING btree ("freelancer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_active_freelancer_job_unique" ON "proposals" USING btree ("job_id","freelancer_id") WHERE "proposals"."status" IN ('pending', 'negotiating', 'accepted');--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_one_accepted_per_job_unique" ON "proposals" USING btree ("job_id") WHERE "proposals"."status" = 'accepted';