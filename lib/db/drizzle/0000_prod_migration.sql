CREATE TABLE "user_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text,
	"email" text,
	"phone" text,
	"default_shipping_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"gender" text,
	"product_type" text,
	"sub_type" text,
	"sku" text,
	"stock" integer DEFAULT 100 NOT NULL,
	"price_in_paise" integer NOT NULL,
	"model_url" text NOT NULL,
	"thumbnail_url" text,
	"additional_images" text,
	"available" boolean DEFAULT true NOT NULL,
	"sizes" text[] DEFAULT '{"S","M","L","XL"}' NOT NULL,
	"default_color" text DEFAULT '#FFFFFF' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"product_id" integer NOT NULL,
	"name" text DEFAULT 'My Design' NOT NULL,
	"color" text DEFAULT '#FFFFFF' NOT NULL,
	"size" text DEFAULT 'M' NOT NULL,
	"parts_enabled" jsonb DEFAULT '{"collar":true,"leftSleeve":true,"rightSleeve":true}'::jsonb NOT NULL,
	"canvas_data" text,
	"preview_image_url" text,
	"front_image_url" text,
	"back_image_url" text,
	"side_image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"cart_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"customization_id" integer,
	"quantity" integer DEFAULT 1 NOT NULL,
	"size" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "carts_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"customization_id" integer,
	"quantity" integer NOT NULL,
	"size" text NOT NULL,
	"price_in_paise" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"total_in_paise" integer NOT NULL,
	"shipping_name" text NOT NULL,
	"shipping_address" text NOT NULL,
	"shipping_city" text NOT NULL,
	"shipping_state" text NOT NULL,
	"shipping_postal_code" text NOT NULL,
	"shipping_phone" text NOT NULL,
	"payment_id" text,
	"razorpay_order_id" text,
	"razorpay_signature" text,
	"shipping_charge_in_paise" integer DEFAULT 0 NOT NULL,
	"shiprocket_order_id" text,
	"shiprocket_awb" text,
	"tracking_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sku_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"type" text NOT NULL,
	"asset_url" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customizations" ADD CONSTRAINT "customizations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_customization_id_customizations_id_fk" FOREIGN KEY ("customization_id") REFERENCES "public"."customizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_customization_id_customizations_id_fk" FOREIGN KEY ("customization_id") REFERENCES "public"."customizations"("id") ON DELETE set null ON UPDATE no action;