CREATE TYPE "public"."marketplace_capability" AS ENUM('client', 'freelancer');--> statement-breakpoint
CREATE TABLE "user_capabilities" (
	"user_id" text NOT NULL,
	"capability" "marketplace_capability" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_capabilities_user_id_capability_pk" PRIMARY KEY("user_id","capability")
);
--> statement-breakpoint
ALTER TABLE "user_capabilities" ADD CONSTRAINT "user_capabilities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_capabilities_capability_idx" ON "user_capabilities" USING btree ("capability");