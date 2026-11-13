CREATE TYPE "public"."delivery_status" AS ENUM('submitted', 'revision_requested', 'approved');--> statement-breakpoint
CREATE TABLE "contract_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"submitted_by_id" text NOT NULL,
	"submission_number" integer NOT NULL,
	"message" text NOT NULL,
	"attachment_url" text,
	"status" "delivery_status" DEFAULT 'submitted' NOT NULL,
	"review_message" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "revisions_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "contract_deliveries" ADD CONSTRAINT "contract_deliveries_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_deliveries" ADD CONSTRAINT "contract_deliveries_submitted_by_id_user_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contract_deliveries_submission_unique" ON "contract_deliveries" USING btree ("contract_id","submission_number");--> statement-breakpoint
CREATE INDEX "contract_deliveries_contract_id_idx" ON "contract_deliveries" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "contract_deliveries_submitted_by_idx" ON "contract_deliveries" USING btree ("submitted_by_id");