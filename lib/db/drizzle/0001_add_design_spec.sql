ALTER TABLE "customizations" ADD COLUMN IF NOT EXISTS "customization_charge_in_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "customizations" ADD COLUMN IF NOT EXISTS "design_spec" jsonb;
