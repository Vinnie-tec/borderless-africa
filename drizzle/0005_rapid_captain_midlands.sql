CREATE TABLE "proposal_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"proposed_price" numeric(12, 2) NOT NULL,
	"delivery_days" integer NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proposal_offers" ADD CONSTRAINT "proposal_offers_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_offers" ADD CONSTRAINT "proposal_offers_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proposal_offers_proposal_id_created_at_idx" ON "proposal_offers" USING btree ("proposal_id","created_at");--> statement-breakpoint
CREATE INDEX "proposal_offers_sender_id_idx" ON "proposal_offers" USING btree ("sender_id");