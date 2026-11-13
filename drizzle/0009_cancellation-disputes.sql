CREATE TYPE "public"."cancellation_request_status" AS ENUM('pending', 'accepted', 'rejected', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."dispute_origin" AS ENUM('cancellation', 'delivery', 'other');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'under_review', 'resolved');--> statement-breakpoint
ALTER TYPE "public"."contract_status" ADD VALUE 'cancellation_pending' BEFORE 'completed';--> statement-breakpoint
CREATE TABLE "cancellation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"requester_id" text NOT NULL,
	"reason" text NOT NULL,
	"previous_contract_status" "contract_status" NOT NULL,
	"status" "cancellation_request_status" DEFAULT 'pending' NOT NULL,
	"response_message" text,
	"response_deadline" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"action" varchar(100) NOT NULL,
	"details" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"message" text NOT NULL,
	"attachment_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"cancellation_request_id" uuid,
	"opened_by_id" text NOT NULL,
	"origin" "dispute_origin" NOT NULL,
	"reason" text NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"decision" varchar(100),
	"resolution" text,
	"decided_by_id" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_events" ADD CONSTRAINT "dispute_events_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_events" ADD CONSTRAINT "dispute_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_cancellation_request_id_cancellation_requests_id_fk" FOREIGN KEY ("cancellation_request_id") REFERENCES "public"."cancellation_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_id_user_id_fk" FOREIGN KEY ("opened_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_decided_by_id_user_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cancellation_requests_contract_id_idx" ON "cancellation_requests" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "cancellation_requests_status_deadline_idx" ON "cancellation_requests" USING btree ("status","response_deadline");--> statement-breakpoint
CREATE UNIQUE INDEX "cancellation_requests_one_pending_per_contract" ON "cancellation_requests" USING btree ("contract_id") WHERE "cancellation_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "dispute_events_dispute_created_at_idx" ON "dispute_events" USING btree ("dispute_id","created_at");--> statement-breakpoint
CREATE INDEX "dispute_messages_dispute_created_at_idx" ON "dispute_messages" USING btree ("dispute_id","created_at");--> statement-breakpoint
CREATE INDEX "disputes_contract_id_idx" ON "disputes" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "disputes_status_created_at_idx" ON "disputes" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_one_active_per_contract" ON "disputes" USING btree ("contract_id") WHERE "disputes"."status" IN ('open', 'under_review');