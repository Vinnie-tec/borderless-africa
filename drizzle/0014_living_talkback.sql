CREATE TYPE "public"."contract_payment_status" AS ENUM('initialized', 'pending', 'successful', 'failed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."payment_webhook_processing_status" AS ENUM('received', 'processed', 'failed');--> statement-breakpoint
CREATE TABLE "contract_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"provider" varchar(30) DEFAULT 'paystack' NOT NULL,
	"provider_reference" varchar(100) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" "contract_payment_status" DEFAULT 'initialized' NOT NULL,
	"authorization_url" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_payments_provider_reference_unique" UNIQUE("provider_reference")
);
--> statement-breakpoint
CREATE TABLE "payment_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(30) DEFAULT 'paystack' NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payment_reference" varchar(100),
	"payload" jsonb NOT NULL,
	"processing_status" "payment_webhook_processing_status" DEFAULT 'received' NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contract_payments" ADD CONSTRAINT "contract_payments_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_payments" ADD CONSTRAINT "contract_payments_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contract_payments_contract_id_idx" ON "contract_payments" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "contract_payments_client_id_idx" ON "contract_payments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "contract_payments_status_idx" ON "contract_payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_payments_one_successful_per_contract" ON "contract_payments" USING btree ("contract_id") WHERE "contract_payments"."status" = 'successful';--> statement-breakpoint
CREATE INDEX "payment_webhook_events_reference_idx" ON "payment_webhook_events" USING btree ("payment_reference");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_status_idx" ON "payment_webhook_events" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_created_at_idx" ON "payment_webhook_events" USING btree ("created_at");