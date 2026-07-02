CREATE TABLE IF NOT EXISTS "coupons" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "type" text NOT NULL,
  "value" integer NOT NULL,
  "min_order_paise" integer DEFAULT 0 NOT NULL,
  "max_usages" integer,
  "max_usages_per_user" integer DEFAULT 1 NOT NULL,
  "expires_at" timestamp with time zone,
  "is_active" boolean DEFAULT true NOT NULL,
  "product_ids" jsonb,
  "category_restriction" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coupon_usages" (
  "id" serial PRIMARY KEY NOT NULL,
  "coupon_id" integer NOT NULL REFERENCES "coupons"("id") ON DELETE cascade,
  "user_id" text NOT NULL,
  "order_id" integer REFERENCES "orders"("id") ON DELETE set null,
  "used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coupon_usages_coupon_id_idx" ON "coupon_usages" ("coupon_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coupon_usages_user_id_idx" ON "coupon_usages" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coupon_usages_order_id_idx" ON "coupon_usages" ("order_id");
