ALTER TABLE "proposal_offers" ADD COLUMN "accepted_by_id" text;--> statement-breakpoint
ALTER TABLE "proposal_offers" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "proposal_offers" ADD CONSTRAINT "proposal_offers_accepted_by_id_user_id_fk" FOREIGN KEY ("accepted_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;